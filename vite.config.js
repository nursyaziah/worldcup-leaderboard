import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base path matches the GitHub Pages URL: https://nursyaziah.github.io/worldcup-leaderboard/
export default defineConfig({
  plugins: [react()],
  base: '/worldcup-leaderboard/',
})
