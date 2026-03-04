/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 앱의 메인 초록색을 미리 지정해둘 수 있습니다.
        mahjongGreen: '#2E7D32', 
        mahjongBeige: '#F5F5DC',
      }
    },
  },
  plugins: [],
}