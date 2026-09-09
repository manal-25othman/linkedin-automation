import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', lg: '2rem' },
      screens: { '2xl': '1280px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-arabic)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      /*
        ارتفاعات سطر العناوين — مقاسة على الخط العربي لا على الافتراضي.
        أصناف `text-{size}` في Tailwind تحمل ارتفاع سطرها معها، وقيمه
        الافتراضية مضبوطة على اللاتيني: `text-4xl` مثلًا ٣٦px بارتفاع
        ٤٠px، وهو أقلّ من كفاية العربية بكثير فتتلاصق سطور العنوان.

        وأخطر من ذلك أنه ارتفاع **مطلق**: عنوان يجمع `sm:text-4xl` مع
        `lg:text-[2.75rem]` يكبر خطّه إلى ٤٤px ويبقى ارتفاع سطره ٤٠px،
        فيصير أصغر من الحرف نفسه ويعلو السطرُ السطرَ. ولا ينفع معه
        `leading-*` بلا بادئة، لأن صنف المقاس عند نقطة الانكسار يعلوه.

        فالقيم هنا **بلا وحدة**: تُحسب من حجم الخط الفعلي مهما تغيّر،
        فتصحّ مع المقاسات الاعتباطية كما تصحّ مع المسمّاة. والمقاسات
        دون `3xl` متروكة على حالها — تلك أحجام نصوص لا عناوين، ولها
        `leading-relaxed` و`leading-loose` صريحة في مواضعها.
      */
      fontSize: {
        '3xl': ['1.875rem', { lineHeight: '1.45' }],
        '4xl': ['2.25rem', { lineHeight: '1.4' }],
        '5xl': ['3rem', { lineHeight: '1.35' }],
        '6xl': ['3.75rem', { lineHeight: '1.3' }],
        '7xl': ['4.5rem', { lineHeight: '1.25' }],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        gold: {
          DEFAULT: 'hsl(var(--gold))',
          foreground: 'hsl(var(--gold-foreground))',
          soft: 'hsl(var(--gold-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
