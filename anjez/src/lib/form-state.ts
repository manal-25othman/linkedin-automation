/**
 * الحالة المشتركة بين النماذج و Server Actions.
 *
 * تعيش في ملف مستقل عمدًا: ملفات "use server" لا يُسمح لها بتصدير أي شيء
 * غير الدوال غير المتزامنة، فتصدير ثابت منها يصل إلى العميل كـ undefined.
 */
export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  errors: Record<string, string>;
};

export const initialFormState: FormState = {
  status: "idle",
  message: "",
  errors: {},
};

export function formError(
  message: string,
  errors: Record<string, string> = {},
): FormState {
  return { status: "error", message, errors };
}

export function formSuccess(message: string): FormState {
  return { status: "success", message, errors: {} };
}
