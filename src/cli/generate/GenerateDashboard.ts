import {buildOptions} from 'alinea/cli/build/BuildOptions'
import {writeFileIfContentsDiffer} from 'alinea/cli/util/FS'
import {publicDefines} from 'alinea/cli/util/PublicDefines'
import {code} from 'alinea/core/util/CodeGen'
import {build} from 'esbuild'
import escapeHtml from 'escape-html'
import fs from 'node:fs'
import path from 'node:path'
import pkg from '../../../package.json'
import {GenerateContext} from './GenerateContext.js'

export async function generateDashboard(
  {rootDir, configDir}: GenerateContext,
  handlerUrl: string,
  staticFile: string
) {
  if (!staticFile.endsWith('.html'))
    throw new Error(
      `The staticFile option in config.dashboard must point to an .html file (include the extension)`
    )
  const entryPoints = {
    entry: 'alinea/cli/static/dashboard/entry',
    config: '@alinea/generated/config.js'
  }
  const basename = path.basename(staticFile, '.html')
  const assetsFolder = path.join(rootDir, path.dirname(staticFile), basename)
  const altConfig = path.join(rootDir, 'tsconfig.alinea.json')
  const tsconfig = fs.existsSync(altConfig) ? altConfig : undefined
  await build({
    format: 'esm',
    target: 'esnext',
    treeShaking: true,
    minify: true,
    splitting: true,
    outdir: assetsFolder,
    bundle: true,
    absWorkingDir: configDir,
    entryPoints,
    platform: 'browser',
    inject: ['alinea/cli/util/WarnPublicEnv'],
    define: {
      'process.env.NODE_ENV': '"production"',
      ...publicDefines(process.env)
    },
    ...buildOptions,
    tsconfig,
    logLevel: 'error'
  }).catch(e => {
    throw 'Could not compile entrypoint'
  })
  const baseUrl = './' + escapeHtml(basename)
  await writeFileIfContentsDiffer(
    path.join(rootDir, staticFile),
    code`
        <!DOCTYPE html>
        <meta charset="utf-8" />
        <link rel="icon" href="data:," />
        <link href="${baseUrl}/entry.css?${pkg.version}" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="handshake_url" value="${handlerUrl}?/auth/handshake" />
        <meta name="redirect_url" value="${handlerUrl}?/auth" />
        <body>
          <script type="module">
            import {boot} from '${baseUrl}/entry.js?${pkg.version}'
            boot('${handlerUrl}')
          </script>
        </body>
      `.toString()
  )
}
