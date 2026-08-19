/**
 * إتمام الاستيثاق. يبدّل الرمز المؤقّت برمز وصول، ثم يسلّمه لنافذة المحرّر
 * عبر `postMessage` — وهي الآلية التي تنتظرها محرّرات Git المبنيّة على
 * بروتوكول Netlify CMS.
 */
export const dynamic = "force-dynamic";

function popupResponse(status: "success" | "error", payload: unknown, origin: string) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;

  // النصّ مُهرَّب بـJSON.stringify، والوجهة محصورة بأصل هذا الموقع.
  const html = `<!doctype html><html lang="ar"><body><p>جارٍ إكمال تسجيل الدخول…</p>
<script>
  (function () {
    var message = ${JSON.stringify(message)};
    function send(event) {
      window.opener && window.opener.postMessage(message, ${JSON.stringify(origin)});
    }
    window.addEventListener("message", send, false);
    window.opener && window.opener.postMessage("authorizing:github", ${JSON.stringify(origin)});
  })();
</script></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const clientId = process.env.GITHUB_OAUTH_ID;
  const clientSecret = process.env.GITHUB_OAUTH_SECRET;

  if (!clientId || !clientSecret) {
    return popupResponse("error", { message: "المحرّر غير مُفعَّل على الخادم." }, url.origin);
  }
  if (!code) {
    return popupResponse("error", { message: "لم يصل رمز الاستيثاق من GitHub." }, url.origin);
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${url.origin}/api/oauth/callback`,
      }),
    });

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (!data.access_token) {
      return popupResponse("error", { message: data.error ?? "تعذّر الحصول على رمز الوصول." }, url.origin);
    }

    return popupResponse("success", { token: data.access_token, provider: "github" }, url.origin);
  } catch {
    return popupResponse("error", { message: "تعذّر الاتصال بـGitHub." }, url.origin);
  }
}
