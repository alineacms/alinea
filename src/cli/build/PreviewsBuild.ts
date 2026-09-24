import type {BuildOptions} from 'esbuild'

/**
 * The previews client that server adapters add to draft pages, served next
 * to the dashboard as `previews.js`. A classic script, so it reads its
 * options from `document.currentScript`.
 */
export function previewsBuild(absWorkingDir: string): BuildOptions {
  return {
    entryPoints: {previews: 'alinea/cli/static/dashboard/previews'},
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    bundle: true,
    minify: true,
    absWorkingDir,
    logLevel: 'error'
  }
}
