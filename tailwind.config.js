/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#062e86',
          light: '#0843b8',
          dark: '#042066',
          foreground: '#ffffff'
        },
        secondary: {
          DEFAULT: '#ec9811',
          light: '#f0a83a',
          dark: '#c4800e',
          foreground: '#000000'
        }
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          primary: '#062e86',
          'primary-content': '#ffffff',
          secondary: '#ec9811',
          'secondary-content': '#000000',
          accent: '#062e86',
          'accent-content': '#ffffff',
          neutral: '#1e1e1e',
          'neutral-content': '#ffffff',
          'base-100': '#ffffff',
          'base-200': '#f3f4f6',
          'base-300': '#e5e7eb',
          info: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          '--rounded-box': '0.5rem',
          '--rounded-btn': '0.375rem',
          '--rounded-badge': '0.25rem',
          '--tab-radius': '0.5rem'
        }
      }
    ]
  }
};