/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  // Los hover: solo en dispositivos con puntero real. En el móvil, sin esto, el
  // efecto se queda "pegado" después de tocar un botón.
  future: { hoverOnlyWhenSupported: true },
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      // Una sola familia en toda la app: Inter (variable, servida desde el propio
      // dominio por @fontsource; la CSP no admite fuentes de terceros). Antes cada
      // sistema operativo pintaba su fuente y la interfaz cambiaba de aspecto.
      fontFamily: {
        sans: ['"Inter Variable"', ...defaultTheme.fontFamily.sans],
      },
      // Movimiento: las mismas curvas que los tokens --ease-* de styles.css.
      // Usar estas clases (ease-out-fluid, duration-200...) y no curvas sueltas,
      // para que todo el sistema se mueva igual.
      transitionTimingFunction: {
        'out-fluid': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-fluid': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)'
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        'rise-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'check-pop': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '70%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'count-pop': { '0%': { scale: '1' }, '40%': { scale: '1.25' }, '100%': { scale: '1' } },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-3px)' },
          '40%, 80%': { transform: 'translateX(3px)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'pop-in': 'pop-in 250ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'rise-in': 'rise-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'check-pop': 'check-pop 400ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'count-pop': 'count-pop 250ms cubic-bezier(0.23, 1, 0.32, 1)',
        shake: 'shake 300ms cubic-bezier(0.77, 0, 0.175, 1)'
      },
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
          // Faltaba en el tema claro: --bc quedaba sin definir y todo
          // `text-base-content` (incluidas las burbujas del chat) heredaba un
          // color claro sobre fondo claro, dejando texto blanco invisible.
          'base-content': '#1f2937',
          info: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          // Esquinas más amables: cajas y desplegables 1rem, botones 0.75rem y
          // insignias e interruptores en píldora (con 0.25rem los toggles salían
          // cuadrados). Lo comparten todas las pantallas.
          '--rounded-box': '1rem',
          '--rounded-btn': '0.75rem',
          '--rounded-badge': '1.9rem',
          '--tab-radius': '0.65rem',
          '--animation-btn': '0.2s',
          '--btn-focus-scale': '0.97'
        }
      },
      {
        dark: {
          primary: '#062e86',
          'primary-content': '#ffffff',
          secondary: '#ec9811',
          'secondary-content': '#000000',
          accent: '#3b82f6',
          'accent-content': '#ffffff',
          neutral: '#111827',
          'neutral-content': '#e2e8f0',
          'base-100': '#1e293b',
          'base-200': '#0f172a',
          'base-300': '#334155',
          'base-content': '#e2e8f0',
          info: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          // Esquinas más amables: cajas y desplegables 1rem, botones 0.75rem y
          // insignias e interruptores en píldora (con 0.25rem los toggles salían
          // cuadrados). Lo comparten todas las pantallas.
          '--rounded-box': '1rem',
          '--rounded-btn': '0.75rem',
          '--rounded-badge': '1.9rem',
          '--tab-radius': '0.65rem',
          '--animation-btn': '0.2s',
          '--btn-focus-scale': '0.97'
        }
      }
    ]
  }
};