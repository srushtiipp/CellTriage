/** @type {import('tailwindcss').Config} */
function withOpacity(variable) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: withOpacity('--color-bg'),
          sidebar: withOpacity('--color-sidebar'),
          surface: withOpacity('--color-surface'),
          surface2: withOpacity('--color-surface-muted'),
          border: withOpacity('--color-border'),
          borderMuted: withOpacity('--color-border-muted'),
        },
        text: {
          primary: withOpacity('--color-text-primary'),
          secondary: withOpacity('--color-text-secondary'),
          muted: withOpacity('--color-text-muted'),
        },
        accent: {
          DEFAULT: withOpacity('--color-accent'),
          dim: withOpacity('--color-accent-dim'),
          strong: withOpacity('--color-accent-strong'),
        },
        status: {
          good: withOpacity('--color-success'),
          goodDim: withOpacity('--color-success-dim'),
          warn: withOpacity('--color-warning'),
          warnDim: withOpacity('--color-warning-dim'),
          bad: withOpacity('--color-danger'),
          badDim: withOpacity('--color-danger-dim'),
        },
      },
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'ui-serif', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '8px',
        cardLg: '14px',
        pill: '999px',
      },
      boxShadow: {
        subtle: '0 1px 2px -1px rgb(var(--color-shadow) / 0.14)',
        lift: '0 10px 24px -12px rgb(var(--color-shadow) / 0.32)',
      },
      letterSpacing: {
        tightest: '-0.015em',
        wideish: '0.06em',
      },
      transitionDuration: {
        180: '180ms',
      },
    },
  },
  plugins: [],
}
