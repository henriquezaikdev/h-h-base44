import tailwindAnimate from 'tailwindcss-animate'
import type { Config } from 'tailwindcss'

/**
 * Tailwind v4 + @config compatibility layer.
 * Theme colours are declared via @theme inline in index.css —
 * this file only carries settings that cannot live in CSS:
 * darkMode strategy and the animate plugin.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [tailwindAnimate],
}

export default config
