/**
 * فحص دخان على الخادم المبنيّ: يشغّل `next start` ثم يتحقّق من المسارات
 * الأساسية — الصفحات العامة، وحراسة اللوحات، وكوكي الإحالة، ومنافذ الـ API.
 *
 * التشغيل: npm run build && npm run test:e2e
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = process.env.E2E_PORT ?? "3100";
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE, { redirect: "manual" });
      if (response.status < 500) return true;
    } catch {
      // الخادم لم يجهز بعد
    }
    await delay(500);
  }
  return false;
}

// detached ينشئ مجموعة عمليات مستقلّة: `npx` يشغّل `next` كعملية ابن، وقتل
// الأب وحده يترك الخادم حيًّا فيبقى السكربت معلّقًا بعد انتهاء الفحوص.
const server = spawn("npx", ["next", "start", "-p", PORT], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production" },
  detached: true,
});

function stopServer() {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // العملية انتهت أصلًا
  }
}

server.stdout.on("data", () => {});
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  if (!(await waitForServer())) {
    console.error("تعذّر تشغيل الخادم.");
    stopServer();
    process.exit(1);
  }

  console.log("\nالصفحات العامة");
  {
    const home = await fetch(BASE);
    const html = await home.text();
    check("الرئيسية تعمل", home.status === 200, `status=${home.status}`);
    check("الرئيسية عربية RTL", html.includes('dir="rtl"') && html.includes("أنجز"));

    const services = await fetch(`${BASE}/services`);
    check("دليل الخدمات يعمل", services.status === 200);

    const servicesHtml = await services.text();
    const slugMatch = servicesHtml.match(/\/services\/([a-z0-9-]+)"/);
    check("توجد خدمة واحدة على الأقل", Boolean(slugMatch), "شغّل npm run db:seed");

    if (slugMatch) {
      const detail = await fetch(`${BASE}/services/${slugMatch[1]}`);
      const detailHtml = await detail.text();
      check("صفحة الخدمة تعمل", detail.status === 200);
      check("صفحة الخدمة تعرض زر الطلب", detailHtml.includes(`/order/${slugMatch[1]}`));

      const order = await fetch(`${BASE}/order/${slugMatch[1]}`);
      check("صفحة الطلب تعمل", order.status === 200);
    }

    for (const path of ["/affiliate", "/track", "/terms", "/privacy"]) {
      const response = await fetch(`${BASE}${path}`);
      check(`${path} يعمل`, response.status === 200, `status=${response.status}`);
    }
  }

  console.log("\nتتبّع الإحالة");
  {
    const viaLink = await fetch(`${BASE}/r/ANJEZ1?to=/services`, { redirect: "manual" });
    const cookie = viaLink.headers.get("set-cookie") ?? "";
    check("رابط /r يحوّل الزائر", viaLink.status >= 300 && viaLink.status < 400);
    check("رابط /r يضع كوكي الإحالة", cookie.includes("anjez_ref=ANJEZ1"));
    check("كوكي الإحالة httpOnly", cookie.toLowerCase().includes("httponly"));

    const external = await fetch(`${BASE}/r/ANJEZ1?to=https://evil.example.com`, {
      redirect: "manual",
    });
    const location = external.headers.get("location") ?? "";
    check(
      "لا يحوّل إلى نطاق خارجي",
      !location.includes("evil.example.com"),
      `location=${location}`,
    );

    const viaQuery = await fetch(`${BASE}/services?ref=ANJEZ1`, { redirect: "manual" });
    const queryCookie = viaQuery.headers.get("set-cookie") ?? "";
    check("?ref= يلتقطه الوسيط", queryCookie.includes("anjez_ref=ANJEZ1"));
    check(
      "الرابط يُنظَّف من ref",
      !(viaQuery.headers.get("location") ?? "").includes("ref="),
    );

    const unknown = await fetch(`${BASE}/r/NOSUCHCODE`, { redirect: "manual" });
    check(
      "كود غير معروف لا يضع كوكي",
      !(unknown.headers.get("set-cookie") ?? "").includes("anjez_ref="),
    );
  }

  console.log("\nحراسة اللوحات");
  {
    const admin = await fetch(`${BASE}/admin`, { redirect: "manual" });
    check(
      "لوحة الإدارة محميّة",
      admin.status >= 300 && (admin.headers.get("location") ?? "").includes("/admin/login"),
      `status=${admin.status}`,
    );

    const partner = await fetch(`${BASE}/partner`, { redirect: "manual" });
    check(
      "لوحة الشريك محميّة",
      partner.status >= 300 && (partner.headers.get("location") ?? "").includes("/partner/login"),
      `status=${partner.status}`,
    );

    for (const path of ["/admin/login", "/partner/login", "/partner/register"]) {
      const response = await fetch(`${BASE}${path}`);
      check(`${path} مفتوح`, response.status === 200);
    }
  }

  console.log("\nمنافذ API والطلبات");
  {
    const webhook = await fetch(`${BASE}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "invoice_paid", data: { metadata: { order_number: "X" } } }),
    });
    check(
      "webhook يرفض بلا سرّ صحيح",
      webhook.status === 401 || webhook.status === 503,
      `status=${webhook.status}`,
    );

    const cron = await fetch(`${BASE}/api/cron/commissions`);
    check(
      "مهمّة العمولات ترفض بلا تصريح",
      cron.status === 401 || cron.status === 503,
      `status=${cron.status}`,
    );

    const order = await fetch(`${BASE}/orders/ANJ-0000-XXXXXX?k=wrong`);
    check("طلب بمفتاح خاطئ لا يُعرض", order.status === 404, `status=${order.status}`);
  }

  console.log(`\nنجح: ${passed} — فشل: ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  stopServer();
  // خروج صريح: مقابس fetch المفتوحة قد تُبقي الحلقة حيّة بعد انتهاء الفحوص.
  process.exit(process.exitCode ?? 0);
}
