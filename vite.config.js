import { defineConfig, loadEnv } from 'vite';
import { localBattlePlugin } from './server/localBattleAI.js';
import { AUTH_PATH, deriveUrls } from './src/net/cloudConfig.js';

export default defineConfig(({ mode }) => {
  // PLAY-1: the game signs in through its own address (cloudConfig.authUrl).
  // In development that path is passed on to Neon here; on Vercel, by the
  // rewrite in vercel.json.
  const neonUrl = (loadEnv(mode, process.cwd(), 'VITE_').VITE_NEON_URL || '').replace(/\/$/, '');
  const auth = neonUrl ? new URL(deriveUrls(neonUrl).auth) : null;
  return {
    plugins: [localBattlePlugin()],
    server: auth ? {
      proxy: {
        [AUTH_PATH]: {
          target: auth.origin,
          changeOrigin: true,
          rewrite: (path) => path.replace(AUTH_PATH, auth.pathname),
          cookieDomainRewrite: '',
        },
      },
    } : {},
  };
});
