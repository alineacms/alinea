import fs from 'node:fs'
import path from 'node:path'
import {writeFileIfContentsDiffer} from 'alinea/cli/util/FS'
import type {CMS} from 'alinea/core/CMS'
import {createId} from 'alinea/core/Id'
import {code} from 'alinea/core/util/CodeGen'
import esbuild from 'esbuild'
import escapeHtml from 'escape-html'
import {buildOptions} from '../build/BuildOptions.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {viewsPlugin} from '../util/ViewsPlugin.js'
import type {GenerateContext} from './GenerateContext.js'

export async function generateDashboard(
  {configLocation, rootDir, configDir}: GenerateContext,
  cms: CMS,
  handlerUrl: string,
  staticFile: string
) {
  if (!staticFile.endsWith('.html'))
    throw new Error(
      'The staticFile option in config.dashboard must point to an .html file (include the extension)'
    )
  const buildId = createId()
  const entryPoints = {
    entry: 'alinea/cli/static/dashboard/entry'
  }
  const basename = path.basename(staticFile, '.html')
  const assetsFolder = path.join(rootDir, path.dirname(staticFile), basename)
  const tsconfigLocation = path.join(rootDir, 'tsconfig.json')
  const tsconfig = fs.existsSync(tsconfigLocation)
    ? tsconfigLocation
    : undefined
  const plugins = [viewsPlugin(rootDir, cms), ignorePlugin]
  await esbuild.build({
    format: 'esm',
    target: 'esnext',
    treeShaking: true,
    minify: true,
    outdir: assetsFolder,
    bundle: true,
    absWorkingDir: configDir,
    entryPoints,
    platform: 'browser',
    inject: ['alinea/cli/util/WarnPublicEnv'],
    alias: {
      'alinea/next': 'alinea/core',
      '#alinea/config': configLocation
    },
    external: ['@alinea/generated'],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.ALINEA_BUILD_ID': JSON.stringify(buildId),
      ...publicDefines(process.env)
    },
    ...buildOptions,
    plugins,
    tsconfig,
    logLevel: 'error'
  })
  const baseUrl = `./${escapeHtml(basename)}`
  await writeFileIfContentsDiffer(
    path.join(rootDir, staticFile),
    code`
        <!DOCTYPE html>
        <meta charset="utf-8" />
        <link rel="icon" href="data:," />
        <link href="${baseUrl}/entry.css?${buildId}" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="handshake_url" value="${handlerUrl}?auth=handshake" />
        <meta name="redirect_url" value="${handlerUrl}?auth=login" />
        <body>
          <script type="module" src="${baseUrl}/entry.js?buildId=${buildId}&handlerUrl=${encodeURIComponent(
            handlerUrl
          )}">
          </script>
        </body>
      `.toString()
  )
}
