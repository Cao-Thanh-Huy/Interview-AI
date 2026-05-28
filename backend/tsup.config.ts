import { defineConfig } from 'tsup'

export default defineConfig([
  // ── Dev build (ESM, no minify, dùng cho `npm run build`) ──────────────────
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    dts: true,
    clean: false,
  },

  // ── Production bundle (ESM, minified, bundle ALL deps trừ external) ────────
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist-pkg',
    minify: true,
    splitting: false,
    external: [
      '@xenova/transformers',
      'better-sqlite3',
      'onnxruntime-node',
      'onnxruntime-web',
      'sharp',
    ],
    // Inject createRequire so CJS modules (dotenv, etc.) work inside ESM bundle
    banner: {
      js: `import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);`,
    },
    clean: false,
  },
])
