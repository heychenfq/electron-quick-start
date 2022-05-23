import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	root: 'src/browser',
	build: {
		outDir: '../../output/browser',
	},
	esbuild: {
		tsconfigRaw: require('./tsconfig.browser.json'),
	},
  plugins: [react()],
});
