/**
 * يلتقط لقطات شاشة للصفحات الرئيسية من الخادم الشغّال (يسجّل الدخول للّوحات).
 * التشغيل: npm run build && npx next start -p 3100 & ثم: node scripts/screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3100";
const OUT = process.env.SHOT_OUT ?? "screenshots";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath:
    process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function shot(page, name, { full = true } = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log(`✓ ${name}`);
}

async function login(context, path, email, password) {
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 20_000 }),
    page.click('button[type="submit"]'),
  ]);
  return page;
}

// ————— صفحات عامة —————
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ar-SA" });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await shot(page, "01-home");

  await page.goto(`${BASE}/services`, { waitUntil: "domcontentloaded" });
  await shot(page, "02-services");

  const firstService = await page.getAttribute('a[href^="/services/"]', "href");
  await page.goto(`${BASE}${firstService}`, { waitUntil: "domcontentloaded" });
  await shot(page, "03-service-detail");

  const orderHref = await page.getAttribute('a[href^="/order/"]', "href");
  await page.goto(`${BASE}${orderHref}`, { waitUntil: "domcontentloaded" });
  await shot(page, "04-order-form");

  await page.goto(`${BASE}/affiliate`, { waitUntil: "domcontentloaded" });
  await shot(page, "05-affiliate-landing");

  await page.goto(`${BASE}/partner/register`, { waitUntil: "domcontentloaded" });
  await shot(page, "06-partner-register");

  // جوال — للتأكّد أن الواجهة متجاوبة
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE, { waitUntil: "domcontentloaded" });
  await shot(mobilePage, "07-home-mobile");
  await mobile.close();

  await context.close();
}

// ————— لوحة الشريك —————
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ar-SA" });
  const page = await login(context, "/partner/login", "partner@anjez.local", "Partner12345");

  await shot(page, "08-partner-dashboard");

  await page.goto(`${BASE}/partner/commissions`, { waitUntil: "domcontentloaded" });
  await shot(page, "09-partner-commissions");

  await page.goto(`${BASE}/partner/payouts`, { waitUntil: "domcontentloaded" });
  await shot(page, "10-partner-payouts");

  await context.close();
}

// ————— لوحة الإدارة —————
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ar-SA" });
  const page = await login(context, "/admin/login", "admin@anjez.local", "Anjez12345");

  await shot(page, "11-admin-overview");

  await page.goto(`${BASE}/admin/orders`, { waitUntil: "domcontentloaded" });
  await shot(page, "12-admin-orders");

  const orderLink = await page.getAttribute('a[href^="/admin/orders/"]', "href");
  if (orderLink) {
    await page.goto(`${BASE}${orderLink}`, { waitUntil: "domcontentloaded" });
    await shot(page, "13-admin-order-detail");
  }

  await page.goto(`${BASE}/admin/commissions`, { waitUntil: "domcontentloaded" });
  await shot(page, "14-admin-commissions");

  await page.goto(`${BASE}/admin/affiliates`, { waitUntil: "domcontentloaded" });
  await shot(page, "15-admin-affiliates");

  await page.goto(`${BASE}/admin/services`, { waitUntil: "domcontentloaded" });
  await shot(page, "16-admin-services");

  await page.goto(`${BASE}/admin/settings`, { waitUntil: "domcontentloaded" });
  await shot(page, "17-admin-settings");

  await context.close();
}

await browser.close();
console.log("تمّت اللقطات في", OUT);
