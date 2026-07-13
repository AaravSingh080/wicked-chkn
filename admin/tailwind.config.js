/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        page: '#FBF3F1',
        card: '#FFFFFF',
        line: '#F0D9D5',
        ink: '#2A100D',
        sub: '#8F625B',
        soft: '#FAEAE7',
        blue: '#D92B21',
        bluesoft: '#FCE7E4',
        navy: '#4A0E0B',
        navytext: '#E8B8B0',
        heroacc: '#FF8A7A',
        thead: '#FBF0EE',
        green: '#1FA45C',
        greendark: '#157A45',
        greenfill: '#E7F5EC',
        red: '#E23B2E',
        redfill: '#FDE8E6',
        amber: '#F2D8A8',
        amberfill: '#FFF9F0',
        barlight: '#F0B8B0'
      },
      fontFamily: {
        display: ['Anton', 'Archivo', 'system-ui', 'sans-serif'],
        body: ['Archivo', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
