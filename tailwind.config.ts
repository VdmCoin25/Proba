import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.25rem',
    },
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#FAFAF9',
          soft: '#F2F1EE',
          dark: '#0C0C0E',
          darksoft: '#151417',
        },
        ink: {
          DEFAULT: '#141414',
          soft: '#5B5A57',
          dark: '#F2F1EE',
          darksoft: '#9A98A3',
        },
        line: {
          DEFAULT: '#E7E5E1',
          dark: '#26252B',
        },
        accent: {
          DEFAULT: '#5B2EFF',
          soft: '#EFEAFF',
          dark: '#7C5CFF',
          darksoft: '#241A4D',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#17171B',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl2: '1.25rem',
        card: '1rem',
        pill: '999px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,20,20,0.04), 0 8px 24px -12px rgba(20,20,20,0.08)',
        lift: '0 12px 32px -8px rgba(20,20,20,0.16)',
        glow: '0 0 0 1px rgba(91,46,255,0.15), 0 12px 32px -8px rgba(91,46,255,0.28)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(1deg)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(10px)' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        float: 'float 6s ease-in-out infinite',
        floatSlow: 'floatSlow 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
