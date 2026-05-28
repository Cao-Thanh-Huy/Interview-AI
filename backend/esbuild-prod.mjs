// esbuild-prod.mjs — Production bundler script
// Bundles all deps into single ESM file with createRequire shim for CJS compat
import { build } from 'esbuild'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('Building production bundle...')

await build({
  entryPoints: [path.join(__dirname, 'src/index.ts')],
  bundle: true,
  format: 'esm',
  outfile: path.join(__dirname, 'dist-pkg/index.js'),
  minify: true,
  platform: 'node',
  target: 'node20',
  external: [
    '@xenova/transformers',
    'better-sqlite3',
    'onnxruntime-node',
    'onnxruntime-web',
    'sharp',
  ],
  // createRequire shim: allows CJS modules (dotenv, ws, etc.) to call require()
  // inside an ESM bundle context (where require is normally undefined)
  banner: {
    js: `import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);`,
  },
})

console.log('Build OK: dist-pkg/index.js')
