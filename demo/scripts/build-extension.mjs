// Builds the Chrome extension into ../extension/dist (load that folder unpacked).
//   board.html / options.html  – extension pages (React + Tailwind), multi-page build
//   content.js                 – Gmail content script (InboxSDK), one self-contained file
//   background.js              – service worker, one self-contained file
//   pageWorld.js               – InboxSDK's page script, copied from the package
//   manifest.json              – copied from ../extension/manifest.json
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const demo = resolve(here, '..');
const extSrc = resolve(demo, 'src/extension');
const out = resolve(demo, '../extension/dist');

// Empty the folder rather than deleting it (Windows refuses while Chrome or a
// terminal has it open)
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out)) rmSync(resolve(out, entry), { recursive: true, force: true });

const shared = { configFile: false, mode: 'extension', logLevel: 'warn' };

// 1. Extension pages
await build({
  ...shared,
  root: extSrc,
  base: './',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: out,
    emptyOutDir: false,
    rollupOptions: {
      input: { board: resolve(extSrc, 'board.html'), options: resolve(extSrc, 'options.html') },
    },
  },
});

// 2–3. Content script and service worker: single files, no imports at runtime
for (const [name, entry] of [['content', 'content.ts'], ['background', 'background.ts']]) {
  await build({
    ...shared,
    publicDir: false,
    build: {
      outDir: out,
      emptyOutDir: false,
      lib: { entry: resolve(extSrc, entry), formats: ['iife'], name: name + 'Script', fileName: () => name + '.js' },
      minify: true,
    },
  });
}

copyFileSync(resolve(demo, 'node_modules/@inboxsdk/core/pageWorld.js'), resolve(out, 'pageWorld.js'));
copyFileSync(resolve(demo, '../extension/manifest.json'), resolve(out, 'manifest.json'));
console.log('Built extension → ' + out);
