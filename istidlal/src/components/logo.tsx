/**
 * شعار استدلال: رمز الاستلزام المنطقي (⊣) معكوسًا ليناسب اتجاه القراءة
 * من اليمين لليسار — «يُستدَل منه». يبقى مقروءًا عند ١٦ بكسل.
 */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx="9" fill="var(--signal)" />
      <path
        d="M21 8.5v15M21 16H10.5"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="10.5" cy="16" r="2.1" fill="#fff" />
    </svg>
  );
}

export function LogoLockup({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-bold text-ink">استدلال</span>
        <span className="mt-0.5 text-[0.62rem] tracking-[0.22em] text-ink-faint numerals-latn">
          ISTIDLAL.AI
        </span>
      </span>
    </span>
  );
}
