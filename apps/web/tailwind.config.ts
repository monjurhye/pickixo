import type { Config } from 'tailwindcss';

/**
 * The palette is intentionally restrained: a warm paper canvas, near-black ink,
 * and a single terracotta accent, with a serif display face for headings. No
 * gradients, no neon — it should read like something made by hand, not a
 * template.
 *
 * Colours are declared as HSL channel triplets in globals.css so that opacity
 * modifiers (bg-accent/10) work and the dark theme is a variable swap only.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          sunken: 'hsl(var(--surface-sunken) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border) / <alpha-value>)',
          strong: 'hsl(var(--border-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'hsl(var(--ink) / <alpha-value>)',
          muted: 'hsl(var(--ink-muted) / <alpha-value>)',
          subtle: 'hsl(var(--ink-subtle) / <alpha-value>)',
          inverted: 'hsl(var(--ink-inverted) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          hover: 'hsl(var(--accent-hover) / <alpha-value>)',
          soft: 'hsl(var(--accent-soft) / <alpha-value>)',
          ink: 'hsl(var(--accent-ink) / <alpha-value>)',
        },
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-bengali)', 'Georgia', 'serif'],
        bengali: ['var(--font-bengali)', 'var(--font-sans)', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // A modest type scale — 1.2 ratio. Big enough to establish hierarchy,
        // restrained enough not to shout.
        'display': ['clamp(2.5rem, 1.7rem + 3.2vw, 4.25rem)', { lineHeight: '1.04', letterSpacing: '-0.02em', fontWeight: '500' }],
        'title': ['clamp(1.75rem, 1.4rem + 1.4vw, 2.375rem)', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '500' }],
        'heading': ['1.375rem', { lineHeight: '1.3', letterSpacing: '-0.014em', fontWeight: '600' }],
        'subheading': ['1.0625rem', { lineHeight: '1.45', letterSpacing: '-0.008em', fontWeight: '600' }],
        'body': ['0.9375rem', { lineHeight: '1.6' }],
        'small': ['0.8125rem', { lineHeight: '1.5' }],
        'micro': ['0.75rem', { lineHeight: '1.45', letterSpacing: '0.01em' }],
      },
      borderRadius: {
        card: '0.375rem',
        control: '0.3125rem',
      },
      boxShadow: {
        // Shadows carry a hint of the ink hue rather than pure black, which
        // keeps them from looking grey and muddy on the warm canvas.
        card: '0 1px 2px hsl(var(--shadow) / 0.04), 0 4px 12px -2px hsl(var(--shadow) / 0.06)',
        raised: '0 2px 4px hsl(var(--shadow) / 0.05), 0 12px 28px -6px hsl(var(--shadow) / 0.10)',
        overlay: '0 16px 48px -12px hsl(var(--shadow) / 0.22)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 1.6s infinite',
        'spin-slow': 'spin-slow 1s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
