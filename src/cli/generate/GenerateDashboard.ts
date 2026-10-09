import {createHash} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {writeFileIfContentsDiffer} from '#/cli/util/FS.js'
import type {CMS} from '#/core/CMS.js'
import {code} from '#/core/util/CodeGen.js'
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
  staticFile: string,
  configFingerprint: string
) {
  if (!staticFile.endsWith('.html'))
    throw new Error(
      'The staticFile option in config.dashboard must point to an .html file (include the extension)'
    )
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
  const result = await esbuild.build({
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
      'process.env.ALINEA_CONFIG_FINGERPRINT':
        JSON.stringify(configFingerprint),
      'process.env.ALINEA_FORCE_AUTH': 'true',
      ...publicDefines(process.env)
    },
    ...buildOptions,
    plugins,
    tsconfig,
    logLevel: 'error',
    metafile: true
  })
  const buildId = await buildHash(
    configDir,
    Object.keys(result.metafile.outputs)
  )
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

/**
 * A hash of the built files: a build that changes nothing keeps its id, so
 * tabs opened after a deploy share the shared worker and content cache of
 * tabs opened before it.
 */
async function buildHash(
  workingDir: string,
  outputs: Array<string>
): Promise<string> {
  const hash = createHash('sha256')
  for (const output of outputs.toSorted()) {
    hash.update(`${path.basename(output)}\n`)
    hash.update(await fs.promises.readFile(path.join(workingDir, output)))
  }
  return hash.digest('hex').slice(0, 16)
}
