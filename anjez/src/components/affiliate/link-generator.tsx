"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * يبني الروابط في المتصفّح انطلاقًا من أصل الصفحة الحالي، فيعمل على أي نطاق
 * (محلي، معاينة، إنتاج) بلا إعداد إضافي.
 */
export function LinkGenerator({
  code,
  services,
}: {
  code: string;
  services: { slug: string; title: string }[];
}) {
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = target ? `${origin}/r/${code}?to=/services/${target}` : `${origin}/r/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card p-6">
      <p className="font-display text-lg font-bold">رابط الإحالة الخاص بك</p>
      <p className="mt-1 text-sm text-ink-muted">
        شاركه كما هو، أو وجّهه إلى خدمة بعينها ليصل الزائر إليها مباشرة.
      </p>

      <label className="label-field mt-5" htmlFor="target">
        الوجهة
      </label>
      <select
        id="target"
        className="input-field"
        value={target}
        onChange={(event) => setTarget(event.target.value)}
      >
        <option value="">الصفحة الرئيسية</option>
        {services.map((service) => (
          <option key={service.slug} value={service.slug}>
            {service.title}
          </option>
        ))}
      </select>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          className="input-field font-mono text-xs"
          dir="ltr"
          onFocus={(event) => event.currentTarget.select()}
          aria-label="رابط الإحالة"
        />
        <Button type="button" onClick={copy} className="shrink-0">
          {copied ? "تم النسخ ✓" : "نسخ الرابط"}
        </Button>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        يعمل أيضًا بإضافة <span dir="ltr" className="font-mono">?ref={code}</span> إلى أي رابط في الموقع.
      </p>
    </div>
  );
}
