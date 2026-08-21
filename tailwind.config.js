/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: false, // app tự quản lý theme riêng qua thuộc tính data-theme, không dùng dark-mode hệ thống
  theme: {
    extend: {
      fontFamily: {
        rounded: ['ui-rounded', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
