import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        'pharma': ['Archivo Narrow', 'Arial Narrow', 'sans-serif'],
        'body': ['Geist', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        'geist': ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        'geist-mono': ['Geist Mono', 'Courier New', 'monospace'],
        'decorative': ['Cinzel', 'serif'],
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        'off-white': "hsl(var(--off-white))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          green: "hsl(var(--primary-green))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          green: "hsl(var(--secondary-green))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          green: "hsl(var(--accent-green))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          'primary-green': "hsl(var(--primary-green))",
          'secondary-green': "hsl(var(--secondary-green))",
          'accent-green': "hsl(var(--accent-green))",
          'lime-green': "hsl(var(--lime-green))",
          'deep-teal': "hsl(var(--deep-teal))",
          'text-light': "hsl(var(--text-light))",
          'light-gray': "hsl(var(--light-gray))",
          'subtle-dark': "hsl(var(--subtle-dark))",
        },
        pharma: {
          charcoal: "hsl(var(--pharma-charcoal))",
          grey: "hsl(var(--pharma-grey))",
          'grey-light': "hsl(var(--pharma-grey-light))",
          green: "hsl(var(--pharma-green))",
          'green-dark': "hsl(var(--pharma-green-dark))",
          blue: "hsl(var(--pharma-blue))",
          'blue-light': "hsl(var(--pharma-blue-light))",
        },
        sage: {
          dark: "hsl(var(--sage-dark))",
          deeper: "hsl(var(--sage-deeper))",
          medium: "hsl(var(--sage-medium))",
          forest: "hsl(var(--sage-forest))",
        },
        teal: {
          midnight: "hsl(var(--teal-midnight))",
          deep: "hsl(var(--teal-deep))",
          deeper: "hsl(var(--teal-deeper))",
          primary: "hsl(var(--teal-primary))",
          darker: "hsl(var(--teal-darker))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-sage-teal': 'var(--gradient-sage-teal)',
        'gradient-teal-midnight': 'var(--gradient-teal-midnight)',
        'gradient-sage-forest': 'var(--gradient-sage-forest)',
        'gradient-warm': 'var(--gradient-warm)',
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'medium': 'var(--shadow-medium)',
        'glow': 'var(--shadow-glow)',
      },
      transitionTimingFunction: {
        'smooth': 'var(--transition-smooth)',
        'spring': 'var(--transition-spring)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-in": {
          "0%": {
            opacity: "0",
            transform: "translateX(-20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "slide-in": "slide-in 0.6s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
