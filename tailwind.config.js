/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        luvig: {
          blue: '#0756a6',
          sky: '#0a74d9',
          light: '#d9ecff',
          graphite: '#171923',
          ink: '#0f172a',
          cloud: '#f6f8fb',
        },
      },
      boxShadow: {
        soft: '0 18px 40px rgba(15, 23, 42, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
