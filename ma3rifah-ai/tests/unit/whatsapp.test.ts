import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature, normalizePhone } from '@/lib/whatsapp/client';
import { extractMessages } from '@/lib/whatsapp/handler';

/**
 * حارس القناة الخارجية.
 *
 * ويب هوك واتساب هو المدخل الوحيد الذي يبدأه غيرنا. لو قُبل طلب بلا
 * توقيع صحيح، لاستطاع أي أحد أن يرسل «رسالة من رقم فلان» فيقرأ معرفة
 * شركته. التحقق من التوقيع هنا ليس تفصيلة بل هو الحدّ.
 */

const SECRET = 'test-app-secret';

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

describe('verifySignature', () => {
  const body = JSON.stringify({ entry: [{ changes: [] }] });

  it('يقبل التوقيع الصحيح', () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it('يرفض التوقيع الموقّع بسرّ آخر', () => {
    expect(verifySignature(body, sign(body, 'wrong-secret'), SECRET)).toBe(false);
  });

  it('يرفض التوقيع الصحيح لجسم مختلف — يمنع إعادة استعمال توقيع', () => {
    const other = JSON.stringify({ entry: [{ changes: [{ hacked: true }] }] });
    expect(verifySignature(other, sign(body), SECRET)).toBe(false);
  });

  it('يرفض غياب الترويسة أو تلفها', () => {
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, '', SECRET)).toBe(false);
    expect(verifySignature(body, 'sha256=', SECRET)).toBe(false);
    expect(verifySignature(body, 'sha1=abcdef', SECRET)).toBe(false);
    expect(verifySignature(body, 'zzz', SECRET)).toBe(false);
  });

  it('يرفض توقيعًا بطول صحيح ومحتوى ليس ست عشريًا', () => {
    const valid = sign(body).slice('sha256='.length);
    expect(verifySignature(body, `sha256=${'z'.repeat(valid.length)}`, SECRET)).toBe(false);
  });

  it('يرفض التوقيع المبتور ولو طابقت بدايته', () => {
    const valid = sign(body).slice('sha256='.length);
    expect(verifySignature(body, `sha256=${valid.slice(0, -2)}`, SECRET)).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('يُبقي الأرقام وحدها', () => {
    expect(normalizePhone('+966 50 123 4567')).toBe('966501234567');
    expect(normalizePhone('966-50-123-4567')).toBe('966501234567');
  });
});

describe('extractMessages', () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { from: '+966501234567', id: 'wamid.1', type: 'text', text: { body: '  سؤالي  ' } },
                { from: '966500000000', id: 'wamid.2', type: 'image', image: { id: 'x' } },
                { from: '966500000001', id: 'wamid.3', type: 'text' },
              ],
            },
          },
        ],
      },
    ],
  };

  it('يستخرج الرسائل النصية ويطبّع أرقامها', () => {
    const messages = extractMessages(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('966501234567');
    expect(messages[0].text).toBe('سؤالي');
  });

  it('لا يرمي على حمولة مشوّهة — إعادة Meta الإرسال أسوأ من تجاهل رسالة', () => {
    for (const bad of [null, undefined, {}, { entry: 'ليست مصفوفة' }, { entry: [null] }]) {
      expect(() => extractMessages(bad)).not.toThrow();
      expect(extractMessages(bad)).toEqual([]);
    }
  });
});
