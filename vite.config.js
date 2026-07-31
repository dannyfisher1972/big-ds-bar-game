import { defineConfig } from 'vite';

export default defineConfig({
  // Served from https://dannyfisher1972.github.io/big-ds-bar-game/ on GitHub
  // Pages, so assets must resolve under this sub-path, not the domain root.
  base: '/big-ds-bar-game/',
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173
  }
});
