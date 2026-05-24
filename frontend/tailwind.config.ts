import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
      },
      animation: {
        'bounce-dot': 'bounce 0.8s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
