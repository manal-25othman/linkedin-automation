import { MessageCircleQuestion } from 'lucide-react';
import { DEMO_SCENARIOS } from '@/content/demo-scenarios';

/**
 * شريط الأسئلة المتحرّك تحت الصدر.
 *
 * يعرض ما يُسأل فعلًا في الشركات — من سيناريوهات العرض التجريبي نفسها،
 * فلا يُخترع سؤال جديد ولا يُنسب إلى عميل. والشريط مكرَّر مرّتين كي
 * يلتفّ بلا قفزة، ويقف عند التحويم كي يُقرأ.
 *
 * النسخة الثانية مخفيّة عن القارئ الصوتيّ: هي للعين لا للمعنى.
 */
export function QuestionRibbon() {
  const questions = DEMO_SCENARIOS.map((scenario) => scenario.question);

  return (
    <div className="mk-marquee relative border-y border-border/60 bg-card/40 py-3.5">
      <div className="mk-marquee-track">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            className="flex shrink-0 items-center gap-3 pe-3"
            aria-hidden={copy === 1}
          >
            {questions.map((question) => (
              <li
                key={`${copy}-${question}`}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border/70 bg-card/70 px-4 py-1.5 text-sm text-muted-foreground"
              >
                <MessageCircleQuestion className="size-4 text-primary" aria-hidden />
                {question}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/** كلمات العنوان تدخل واحدةً تلو الأخرى */
export function SplitWords({ text, baseDelay = 0 }: { text: string; baseDelay?: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((word, index) => (
        // المسافة خارج الكتلة لا داخلها: المسافة في آخر inline-block تُحذف
        // عند التصيير فتلتصق الكلمات
        <span key={`${word}-${index}`}>
          <span
            className="mk-word inline-block"
            style={{ animationDelay: `${baseDelay + index * 70}ms` }}
          >
            {word}
          </span>
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </>
  );
}
