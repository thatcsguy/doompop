import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5180, host: '127.0.0.1' },
  // song audio and data live under songs/<slug>/; serve them as-is
  assetsInclude: ['**/*.wav', '**/*.mp3', '**/*.m4a'],
});
