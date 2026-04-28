/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta corporativa CEA EXPORT (azul del logo)
        cea: {
          50: '#eff8ff',
          100: '#dbedff',
          200: '#bee0ff',
          300: '#92cdff',
          400: '#5fb1ff',
          500: '#3990fc',
          600: '#2272f1',
          700: '#1a5add',
          800: '#1c4ab3',
          900: '#1d418d',
          950: '#162a55',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
