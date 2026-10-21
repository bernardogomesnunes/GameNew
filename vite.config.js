import { defineConfig } from 'vite';
import { localBattlePlugin } from './server/localBattleAI.js';
export default defineConfig({ plugins:[localBattlePlugin()] });
