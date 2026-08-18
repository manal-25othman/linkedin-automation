import type { Metadata } from "next";
import { TrackForm } from "@/components/forms/track-form";

export const metadata: Metadata = {
  title: "تتبّع طلبك",
  description: "اعرف حالة طلبك في أنجز برقم الطلب ورقم جوالك.",
};

export default function TrackPage() {
  return (
    <div className="container-page max-w-md py-16">
      <h1 className="font-display text-3xl font-extrabold">تتبّع طلبك</h1>
      <p className="mt-2 text-ink-muted">
        أدخل رقم الطلب ورقم الجوال الذي طلبت به، ولا حاجة لإنشاء حساب.
      </p>
      <div className="mt-8">
        <TrackForm />
      </div>
    </div>
  );
}
