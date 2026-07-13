/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        sub: 'var(--sub)',
        soft: 'var(--soft)',
        blue: 'var(--blue)',
        bluesoft: 'var(--blueSoft)',
        tile: 'var(--tile)',
        hero: 'var(--hero)',
        heroacc: '#FF8A7A',
        herotext: '#E8B8B0',
        green: '#1FA45C',
        greendark: '#157A45',
        greenfill: '#E7F5EC',
        red: '#E23B2E',
        nonveg: '#C0392B',
        spicyfill: '#FDE8E6',
        disabled: '#CBA49D',
        tabinactive: '#BE948C'
      },
      fontFamily: {
        display: ['Anton', 'Archivo', 'system-ui', 'sans-serif'],
        body: ['Archivo', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        cta: '3px 3px 0 var(--shadowInk)',
        logo: '5px 5px 0 rgba(0,0,0,.3)'
      }
    }
  },
  plugins: []
};
