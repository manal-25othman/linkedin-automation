import type { FaqItem } from '@/content/faq';
import type { SiteText } from '@/lib/content/site-text';
import { groupRows } from '@/lib/content/group';

/**
 * قراءة الأسئلة الشائعة من المحتوى المحرَّر.
 *
 * مصدر واحد لموضعين: صفحة الأسئلة الكاملة، والمختارات في الصفحة
 * الرئيسية. ولو فُصلا لصار السؤال الواحد نسختين تتباعدان مع أول تعديل،
 * فتقرأ الشركة في الرئيسية جوابًا نُسخ عنه في صفحة الأسئلة.
 */

function toItem(row: Record<string, string>): FaqItem {
  return { question: row.question ?? '', answer: row.answer ?? '' };
}

/** كل الأسئلة مجمّعة بأقسامها، بترتيب أول ظهور للقسم */
export function faqGroups(t: SiteText): { category: string; items: FaqItem[] }[] {
  const rows = t.list('faq.items').filter((row) => (row.question ?? '').trim() !== '');
  return groupRows(rows, 'category').map((group) => ({
    category: group.key,
    items: group.items.map(toItem),
  }));
}

/** ما عُلّم بالظهور في الصفحة الرئيسية */
export function homeFaq(t: SiteText): FaqItem[] {
  return t
    .list('faq.items')
    .filter(
      (row) => (row.question ?? '').trim() !== '' && (row.home ?? '').trim() !== '',
    )
    .map(toItem);
}

/** أسئلة قسم بعينه — تُستعمل في صفحة الأسعار */
export function faqByCategory(t: SiteText, category: string): FaqItem[] {
  return faqGroups(t).find((group) => group.category === category)?.items ?? [];
}
