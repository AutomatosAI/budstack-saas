import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './templates/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'Courier New', 'monospace'],
        // Budstacks marketing — paid fonts first, free fallbacks second
        'bs-sans': ['"Söhne"', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        'bs-serif': ['"GT Sectra"', 'var(--font-fraunces)', 'var(--font-playfair)', 'Georgia', 'serif'],
        'bs-mono': ['var(--font-jetbrains-mono)', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
        // Budstacks admin design system — Cormorant Garamond for titles & big metric numbers
        display: ['var(--font-cormorant)', '"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      fontSize: {
        'display-xl': ['48px', { lineHeight: '1.05', letterSpacing: '-0.01em' }],
        'display-lg': ['32px', { lineHeight: '1.10' }],
        'display-md': ['22px', { lineHeight: '1.20' }],
        'display-num': ['36px', { lineHeight: '1', letterSpacing: '-0.01em' }],
        'mono-eyebrow': ['11px', { lineHeight: '1.4', letterSpacing: '0.20em' }],
        'mono-chip': ['11px', { lineHeight: '1.4', letterSpacing: '0.10em' }],
        'mono-cell': ['12.5px', { lineHeight: '1.4' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        // Budstacks admin design system tints
        'bs-green-tint': 'linear-gradient(rgba(82,217,122,0.06), rgba(82,217,122,0.06))',
        'bs-gold-tint': 'linear-gradient(rgba(231,219,184,0.14), rgba(231,219,184,0.14))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Budstacks admin design system radii
        'bs-sm': '6px',
        'bs-md': '10px',
        'bs-lg': '16px',
        'bs-pill': '9999px',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // Budstacks marketing palette — premium dark + neon green + warm gold
        bs: {
          'bg-0': '#07090A',
          'bg-1': '#0C1011',
          'bg-2': '#121618',
          'bg-3': '#1A1F21',
          surface: '#151A1C',
          'surface-hi': '#1E2427',
          border: '#222A2C',
          'border-hi': '#2F3A3D',
          'fg-0': '#F5F6F4',
          'fg-1': '#C6CCC8',
          'fg-2': '#8A928E',
          'fg-3': '#5A615E',
          green: {
            900: '#0B2617',
            700: '#124F2A',
            500: '#2FB560',
            400: '#52D97A',
            300: '#8CF0A4',
            glow: '#9BFF9E',
          },
          gold: {
            500: '#C9A96E',
            400: '#D9BC82',
            300: '#E8D19E',
          },
        },
        // Budstacks admin design system — flat bs-* keys (coexist with nested bs.* during migration)
        // Surface
        'bs-bg': '#07090A',
        'bs-bg-smoke': '#050a07',
        'bs-canvas': '#07090A',
        'bs-card': '#151A1C',
        'bs-card-2': '#1A2123',
        'bs-input': '#0F1517',
        'bs-hover': '#1A2123',
        'bs-step-200': '#222A2C',
        'bs-step-300': '#2F3A3D',
        'bs-border': '#222A2C',
        'bs-border-100': '#1c2326',
        // Text
        'bs-fg': '#F5F6F4',
        'bs-fg-2': '#F2F4F2',
        'bs-fg-body': '#C6CCC8',
        'bs-fg-body-2': '#EAEEEA',
        'bs-fg-muted': '#8A938F',
        // Brand green (flat — coexists with nested bs.green.500/.400)
        'bs-green': '#52D97A',
        'bs-green-deep': '#2FB560',
        'bs-green-soft': '#8CF0A4',
        // Gold (flat — coexists with nested bs.gold.500/.400)
        'bs-gold': '#D9BC82',
        'bs-gold-soft': '#E8D19E',
        'bs-gold-cream': '#fcfcbc',
        // Semantic
        'bs-danger': '#F87171',
        'bs-warn': '#F5C26B',
        'bs-info': '#7DB7FF',
      },
      boxShadow: {
        'bs-card': '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 60px -30px rgba(0,0,0,0.7)',
        'bs-pill-nav': '0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 50px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4), 0 0 60px -20px rgba(82,217,122,0.25)',
        'bs-pill-footer': '0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 80px -20px rgba(0,0,0,0.7), 0 0 80px -30px rgba(82,217,122,0.22)',
        'bs-green': '0 0 0 1px rgba(82,217,122,0.3), 0 10px 30px -10px rgba(82,217,122,0.4)',
        'bs-green-hover': '0 0 0 1px rgba(82,217,122,0.5), 0 14px 40px -8px rgba(82,217,122,0.55)',
        'bs-card-hover': '0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(82,217,122,0.18), 0 24px 70px -28px rgba(0,0,0,0.8)',
        'bs-glow': '0 0 0 1px rgba(82,217,122,0.30), 0 10px 30px -10px rgba(82,217,122,0.40)',
        'bs-glow-hover': '0 0 0 1px rgba(82,217,122,0.50), 0 14px 40px -8px rgba(82,217,122,0.55)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'focus-ring': {
          '0%': {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        'focus-pulse': {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0.8',
          },
        },
        'skip-link-slide': {
          from: {
            transform: 'translateY(-100%)',
            opacity: '0',
          },
          to: {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
        shimmer: {
          '0%': {
            transform: 'translateX(-100%)',
          },
          '100%': {
            transform: 'translateX(100%)',
          },
        },
        wiggle: {
          '0%, 100%': {
            transform: 'rotate(0deg)',
          },
          '25%': {
            transform: 'rotate(-10deg)',
          },
          '75%': {
            transform: 'rotate(10deg)',
          },
        },
        'bs-cube-float': {
          '0%, 100%': { transform: 'translateY(0) rotate(-0.5deg)' },
          '50%': { transform: 'translateY(-14px) rotate(0.5deg)' },
        },
        'bs-sparkle': {
          '0%, 100%': { opacity: '0.15', transform: 'translate(0, 0) scale(0.8)' },
          '50%': { opacity: '0.9', transform: 'translate(0, -8px) scale(1.1)' },
        },
        'bs-smoke-drift': {
          '0%': { transform: 'translate(0, 0) scale(1.02)' },
          '50%': { transform: 'translate(-3%, 2%) scale(1.06)' },
          '100%': { transform: 'translate(3%, -2%) scale(1.04)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'focus-ring': 'focus-ring 0.15s ease-out',
        'focus-pulse': 'focus-pulse 2s ease-in-out infinite',
        'skip-link-slide': 'skip-link-slide 0.2s ease-out',
        'bs-cube-float': 'bs-cube-float 6s ease-in-out infinite',
        'bs-sparkle-1': 'bs-sparkle 4s ease-in-out infinite',
        'bs-sparkle-2': 'bs-sparkle 5s ease-in-out infinite 1s',
        'bs-sparkle-3': 'bs-sparkle 6s ease-in-out infinite 2s',
        'bs-sparkle-4': 'bs-sparkle 7s ease-in-out infinite 3s',
        'bs-smoke-drift': 'bs-smoke-drift 38s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
