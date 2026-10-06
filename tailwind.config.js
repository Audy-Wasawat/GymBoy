/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        control: 'rgb(var(--control) / <alpha-value>)',
        weights: 'rgb(var(--plate-red) / <alpha-value>)',
        running: 'rgb(var(--plate-blue) / <alpha-value>)',
        other: 'rgb(var(--plate-yellow) / <alpha-value>)',
        food: 'rgb(var(--plate-green) / <alpha-value>)'
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1.125rem',
        '2xl': '1.375rem'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
}
