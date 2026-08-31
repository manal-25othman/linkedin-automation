import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { saveCommissionSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { halalasToRiyals } from "@/lib/money";
import { activeProviderName } from "@/lib/payments";

export const metadata: Metadata = { title: "الإعدادات", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const { commission } = settings;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">الإعدادات</h1>
        <p className="mt-1 text-ink-muted">
          هذه القيم تحكم كل حساب عمولة لاحق. الطلبات القائمة لا تتأثّر — نسبتها مقفلة عليها.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <p className="mb-4 font-display text-lg font-bold">برنامج العمولة</p>
          <ActionForm action={saveCommissionSettings} submitLabel="حفظ الإعدادات">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field" htmlFor="defaultPercent">النسبة الأساسية ٪</label>
                <input
                  id="defaultPercent"
                  name="defaultPercent"
                  className="input-field"
                  defaultValue={commission.defaultBps / 100}
                  required
                />
              </div>
              <div>
                <label className="label-field" htmlFor="maxPercent">السقف الأعلى ٪</label>
                <input
                  id="maxPercent"
                  name="maxPercent"
                  className="input-field"
                  defaultValue={commission.maxBps / 100}
                  required
                />
              </div>
              <div>
                <label className="label-field" htmlFor="bonusSilverPercent">مكافأة الفضّي ٪</label>
                <input
                  id="bonusSilverPercent"
                  name="bonusSilverPercent"
                  className="input-field"
                  defaultValue={commission.tierBonusBps.SILVER / 100}
                />
              </div>
              <div>
                <label className="label-field" htmlFor="bonusGoldPercent">مكافأة الذهبي ٪</label>
                <input
                  id="bonusGoldPercent"
                  name="bonusGoldPercent"
                  className="input-field"
                  defaultValue={commission.tierBonusBps.GOLD / 100}
                />
              </div>
              <div>
                <label className="label-field" htmlFor="thresholdSilver">عتبة الفضّي (ريال)</label>
                <input
                  id="thresholdSilver"
                  name="thresholdSilver"
                  className="input-field"
                  defaultValue={halalasToRiyals(commission.tierThresholds.silver)}
                  required
                />
              </div>
              <div>
                <label className="label-field" htmlFor="thresholdGold">عتبة الذهبي (ريال)</label>
                <input
                  id="thresholdGold"
                  name="thresholdGold"
                  className="input-field"
                  defaultValue={halalasToRiyals(commission.tierThresholds.gold)}
                  required
                />
              </div>
              <div>
                <label className="label-field" htmlFor="holdDays">مدّة تثبيت العمولة (أيام)</label>
                <input
                  id="holdDays"
                  name="holdDays"
                  type="number"
                  min={0}
                  className="input-field"
                  defaultValue={commission.holdDays}
                  required
                />
              </div>
              <div>
                <label className="label-field" htmlFor="attributionWindowDays">
                  نافذة الإحالة (أيام)
                </label>
                <input
                  id="attributionWindowDays"
                  name="attributionWindowDays"
                  type="number"
                  min={1}
                  className="input-field"
                  defaultValue={commission.attributionWindowDays}
                  required
                />
              </div>
              <div>
                <label className="label-field" htmlFor="minPayout">أقل مبلغ سحب (ريال)</label>
                <input
                  id="minPayout"
                  name="minPayout"
                  className="input-field"
                  defaultValue={halalasToRiyals(commission.minPayout)}
                  required
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="autoApprove"
                defaultChecked={settings.autoApprove}
                className="accent-brand"
              />
              اعتماد العمولات تلقائيًا عند انقضاء مدّة التثبيت
            </label>

            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field" htmlFor="bankBeneficiary">
                  اسم المستفيد (للتحويل البنكي)
                </label>
                <input
                  id="bankBeneficiary"
                  name="bankBeneficiary"
                  className="input-field"
                  defaultValue={settings.bankTransfer.beneficiary}
                />
              </div>
              <div>
                <label className="label-field" htmlFor="bankIban">الآيبان</label>
                <input
                  id="bankIban"
                  name="bankIban"
                  className="input-field font-mono"
                  dir="ltr"
                  placeholder="SA0000000000000000000000"
                  defaultValue={settings.bankTransfer.iban}
                />
              </div>
              <div>
                <label className="label-field" htmlFor="bankName">اسم البنك</label>
                <input
                  id="bankName"
                  name="bankName"
                  className="input-field"
                  defaultValue={settings.bankTransfer.bankName}
                />
              </div>
              <div>
                <label className="label-field" htmlFor="contactWhatsapp">واتساب التواصل</label>
                <input
                  id="contactWhatsapp"
                  name="contactWhatsapp"
                  className="input-field"
                  dir="ltr"
                  defaultValue={settings.contactWhatsapp}
                />
              </div>
              <div>
                <label className="label-field" htmlFor="contactEmail">بريد التواصل</label>
                <input
                  id="contactEmail"
                  name="contactEmail"
                  className="input-field"
                  dir="ltr"
                  defaultValue={settings.contactEmail}
                />
              </div>
            </div>
          </ActionForm>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <p className="font-display text-lg font-bold">بوّابة الدفع</p>
            <p className="mt-2 text-sm text-ink-muted">
              المزوّد النشط: <span className="font-mono font-bold text-ink">{activeProviderName()}</span>
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              <span className="font-mono">manual</span> يعني التحويل البنكي اليدوي: العميل
              يحوّل، وأنت تؤكّد الاستلام من صفحة الطلب فتُحتسب العمولة.
              يُضبط من متغيّرات البيئة لا من هنا: <span className="font-mono">PAYMENT_PROVIDER</span>{" "}
              و <span className="font-mono">MOYASAR_SECRET_KEY</span> و{" "}
              <span className="font-mono">MOYASAR_WEBHOOK_SECRET</span>. مفاتيح الدفع لا تُخزَّن في
              قاعدة البيانات.
            </p>
          </div>

          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
