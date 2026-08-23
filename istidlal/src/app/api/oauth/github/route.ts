import { NextResponse } from "next/server";

/**
 * بداية استيثاق GitHub للمحرّر. لا نستعمل وسيط استيثاق خارجيًّا:
 * الموقع نفسه يحمل طرفَي التدفّق، فلا يمرّ رمز الوصول بطرف ثالث.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const clientId = process.env.GITHUB_OAUTH_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "المحرّر غير مُفعَّل: اضبط GITHUB_OAUTH_ID و GITHUB_OAUTH_SECRET." },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${origin}/api/oauth/callback`);
  // `repo` مطلوبة لأن المحرّر يكتب ملفات المحتوى في المستودع.
  authorize.searchParams.set("scope", "repo,user");
  authorize.searchParams.set("state", crypto.randomUUID());

  return NextResponse.redirect(authorize.toString());
}
