export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary:   '#0B1220',
          secondary: '#111827',
          card:      '#1C2A3A',
          border:    '#243447',
        },
        gold: {
          DEFAULT: '#C9A449',
          bright:  '#F5C842',
          deep:    '#B8922F',
        },
        text: {
          primary: '#FFFFFF',
          body:    '#CBD5E1',
          muted:   '#94A3B8',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans:  ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
