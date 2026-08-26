/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/website/frontend/src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/shared/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        'bg-main': '#F4F7FC',
        page: '#F4F7FC',
        'shell-ink': '#1A1A1A',
        'shell-text': '#111827',
        'shell-muted': '#6B7280',
        'shell-border': '#E5E7EB',
        'shell-blue': '#2563EB',
        'shell-red': '#DC2626',
        'candela-blue': '#2563EB',
        'candela-dark': '#1A1A1A',
        'candela-secondary': '#6B7280',
      },
      keyframes: {
        rotateWheel: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        popAnim: {
          'to': { transform: 'scale(1.7)', opacity: '0' },
        },
        shake: {
          '0%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '50%': { transform: 'translateX(6px)' },
          '75%': { transform: 'translateX(-6px)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        rotateWheel: 'rotateWheel 25s linear infinite',
        pop: 'popAnim 0.25s ease-out forwards',
        shake: 'shake 0.3s ease',
      },
    },
  },
  plugins: [],
};
