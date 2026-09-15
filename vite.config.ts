import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 使用相对路径，这样同一份构建产物既能部署在根目录（Vercel/Netlify），
  // 也能部署在子路径（GitHub Pages 的 /Thinkingspace/）而不需要改配置。
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
});
