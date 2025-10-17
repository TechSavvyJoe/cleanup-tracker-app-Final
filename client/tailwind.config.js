/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      // X-style (Twitter) inspired color palette
      colors: {
        'x-bg': '#000000',
        'x-bg-secondary': '#16181c',
        'x-bg-hover': '#1c1f26',
        'x-border': '#2f3336',
        'x-text': '#e7e9ea',
        'x-text-secondary': '#71767b',
        'x-blue': '#1d9bf0',
        'x-blue-hover': '#1a8cd8',
        'x-red': '#f4212e',
        'x-green': '#00ba7c',
        'x-yellow': '#ffd400',
        'x-purple': '#7856ff',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-urgent': 'pulse-urgent 2s infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
        'bounce-subtle': 'bounce-subtle 2s infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-urgent': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(29, 155, 240, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(29, 155, 240, 0.6)' },
        },
      },
      boxShadow: {
        'x-card': '0 0 0 1px rgb(47, 51, 54)',
        'x-hover': '0 0 0 1px rgb(47, 51, 54), 0 10px 40px rgba(0, 0, 0, 0.5)',
        'glow-blue': '0 0 30px rgba(29, 155, 240, 0.4)',
        'glow-green': '0 0 30px rgba(0, 186, 124, 0.4)',
        'glow-purple': '0 0 30px rgba(120, 86, 255, 0.4)',
      },
      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [],
}

