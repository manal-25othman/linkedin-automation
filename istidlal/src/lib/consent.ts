/**
 * إدارة موافقة الكوكيز. الافتراضي رفض كل ما ليس ضروريًّا، ولا يُحمَّل أي
 * سكربت تحليلي أو إعلاني قبل موافقة صريحة — وهو ما تشترطه سياسات Google
 * لمستخدمي المنطقة الاقتصادية الأوروبية والمملكة المتحدة.
 */
export const CONSENT_KEY = "istidlal-consent";
/** رفع الإصدار يُعيد سؤال الزوّار السابقين بعد أي تغيير جوهري في السياسة. */
export const CONSENT_VERSION = 1;

export type ConsentState = {
  /** قياس الزيارات — Google Analytics. */
  analytics: boolean;
  /** الإعلانات وتخصيصها — Google AdSense. */
  ads: boolean;
  version: number;
  /** وقت الموافقة بصيغة ISO — دليل الامتثال عند أي مراجعة. */
  decidedAt: string;
};

export const DENY_ALL: Omit<ConsentState, "decidedAt"> = {
  analytics: false,
  ads: false,
  version: CONSENT_VERSION,
};

/** حدث داخلي يفتح لوحة التفضيلات من أي مكان (رابط التذييل مثلًا). */
export const OPEN_PREFERENCES_EVENT = "istidlal:open-consent";

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    // قرار من إصدار سياسة أقدم يُعامل كأنه غير موجود.
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(choice: { analytics: boolean; ads: boolean }): ConsentState {
  const state: ConsentState = {
    ...choice,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  applyToGoogleConsentMode(state);
  window.dispatchEvent(new CustomEvent("istidlal:consent-changed", { detail: state }));
  return state;
}

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };

/** يبلّغ وضع الموافقة من Google بالقرار (Consent Mode v2). */
export function applyToGoogleConsentMode(state: { analytics: boolean; ads: boolean }) {
  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer || [];
  const gtag = w.gtag ?? ((...args: unknown[]) => w.dataLayer!.push(args));
  gtag("consent", "update", {
    analytics_storage: state.analytics ? "granted" : "denied",
    ad_storage: state.ads ? "granted" : "denied",
    ad_user_data: state.ads ? "granted" : "denied",
    ad_personalization: state.ads ? "granted" : "denied",
  });
}

/**
 * يُحقَن في `<head>` قبل أي سكربت آخر: يضبط الحالة الافتراضية على الرفض،
 * ثم يحدّثها فورًا بقرار الزائر السابق إن وُجد — فلا تُرسل إشارة واحدة
 * قبل الموافقة، ولا يُسأل الموافق مرتين.
 */
export const CONSENT_BOOTSTRAP = `(function(){
  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag=window.gtag||gtag;
  gtag('consent','default',{
    ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',
    analytics_storage:'denied',functionality_storage:'granted',
    security_storage:'granted',wait_for_update:500
  });
  try{
    var raw=localStorage.getItem('${CONSENT_KEY}');
    if(raw){
      var c=JSON.parse(raw);
      if(c && c.version===${CONSENT_VERSION}){
        gtag('consent','update',{
          analytics_storage:c.analytics?'granted':'denied',
          ad_storage:c.ads?'granted':'denied',
          ad_user_data:c.ads?'granted':'denied',
          ad_personalization:c.ads?'granted':'denied'
        });
      }
    }
  }catch(e){}
})();`;
