"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  DENY_ALL,
  OPEN_PREFERENCES_EVENT,
  readConsent,
  writeConsent,
  type ConsentState,
} from "@/lib/consent";

type Mode = "hidden" | "banner" | "preferences";

/**
 * لافتة الموافقة على الكوكيز. لا تظهر لمن قرّر سابقًا، ويمكن فتحها مجدّدًا
 * من رابط «إدارة الكوكيز» في التذييل — سحب الموافقة يجب أن يكون بسهولة منحها.
 */
export function CookieConsent() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (!existing) {
      setMode("banner");
      return;
    }
    setAnalytics(existing.analytics);
    setAds(existing.ads);
  }, []);

  useEffect(() => {
    const open = () => {
      const existing: ConsentState | null = readConsent();
      setAnalytics(existing?.analytics ?? false);
      setAds(existing?.ads ?? false);
      setMode("preferences");
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, open);
  }, []);

  const decide = useCallback((choice: { analytics: boolean; ads: boolean }) => {
    writeConsent(choice);
    setAnalytics(choice.analytics);
    setAds(choice.ads);
    setMode("hidden");
  }, []);

  if (mode === "hidden") return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-surface/95 backdrop-blur-md"
    >
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {mode === "banner" ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 id="consent-title" className="font-display text-base font-bold text-ink">
                نستخدم ملفات ارتباط
              </h2>
              <p className="mt-1.5 text-sm leading-7 text-ink-muted">
                الضرورية تعمل دائمًا لتشغيل الموقع. أما التحليلية والإعلانية فلا يُحمَّل أي سكربت
                منها قبل موافقتك. اقرأ{" "}
                <Link href="/cookie-policy" className="text-signal hover:underline">
                  سياسة الكوكيز
                </Link>{" "}
                و
                <Link href="/privacy-policy" className="text-signal hover:underline">
                  سياسة الخصوصية
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => decide({ analytics: true, ads: true })}
                className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-hover"
              >
                أوافق على الكل
              </button>
              <button
                type="button"
                onClick={() => decide({ ...DENY_ALL })}
                className="rounded-xl border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-signal-line"
              >
                الضروري فقط
              </button>
              <button
                type="button"
                onClick={() => setMode("preferences")}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-muted underline underline-offset-4 transition hover:text-signal"
              >
                تخصيص
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4">
              <h2 id="consent-title" className="font-display text-base font-bold text-ink">
                تفضيلات ملفات الارتباط
              </h2>
              <button
                type="button"
                onClick={() => setMode("hidden")}
                aria-label="إغلاق"
                className="text-ink-faint transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <ConsentRow
                title="ضرورية"
                description="تشغيل الموقع وحفظ تفضيل الوضع الداكن في متصفّحك. لا يمكن تعطيلها."
                checked
                locked
              />
              <ConsentRow
                title="تحليلية"
                description="قياس مجمّع لعدد الزيارات والصفحات الأكثر فائدة (Google Analytics)."
                checked={analytics}
                onChange={setAnalytics}
              />
              <ConsentRow
                title="إعلانية"
                description="عرض إعلانات Google وقياس أدائها ومنع تكرارها (AdSense)."
                checked={ads}
                onChange={setAds}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => decide({ analytics, ads })}
                className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-hover"
              >
                حفظ التفضيلات
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics: true, ads: true })}
                className="rounded-xl border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-signal-line"
              >
                قبول الكل
              </button>
              <button
                type="button"
                onClick={() => decide({ ...DENY_ALL })}
                className="rounded-xl border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-signal-line"
              >
                رفض غير الضروري
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentRow({
  title,
  description,
  checked,
  locked = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-line bg-bg p-4 ${
        locked ? "opacity-70" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--signal)]"
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-6 text-ink-muted">{description}</span>
      </span>
    </label>
  );
}

/** رابط إعادة فتح اللوحة — يُوضع في التذييل. */
export function CookiePreferencesLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))}
      className="text-ink-muted transition hover:text-signal"
    >
      إدارة ملفات الارتباط
    </button>
  );
}
