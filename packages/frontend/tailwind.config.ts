/** Tailwind theme tokens for the DyingStar admin design system (`ds-*` colors). */
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ds: {
          bg: '#0d0d14',
          surface: '#16161f',
          'surface-hover': 'rgba(255,255,255,0.05)',
          'surface-elevated': 'rgba(255,255,255,0.03)',
          border: '#2a2a3a',
          accent: 'rgba(255,186,8,0.8)',
          text: 'rgb(255,186,8)',
          muted: '#6b6b80',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
