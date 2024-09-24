import {buildOptions} from 'alinea/cli/build/BuildOptions'
import {writeFileIfContentsDiffer} from 'alinea/cli/util/FS'
import {publicDefines} from 'alinea/cli/util/PublicDefines'
import {createId} from 'alinea/core/Id'
import {code} from 'alinea/core/util/CodeGen'
import {build} from 'esbuild'
import escapeHtml from 'escape-html'
import fs from 'node:fs'
import path from 'node:path'
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
  const revision = createId()
  const entryPoints = {
    entry: 'alinea/cli/static/dashboard/entry'
  }
  const basename = path.basename(staticFile, '.html')
  const assetsFolder = path.join(rootDir, path.dirname(staticFile), basename)
  const tsconfigLocation = path.join(rootDir, 'tsconfig.json')
  const tsconfig = fs.existsSync(tsconfigLocation)
    ? tsconfigLocation
    : undefined
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
  })
  const baseUrl = './' + escapeHtml(basename)
  await writeFileIfContentsDiffer(
    path.join(rootDir, staticFile),
    code`
        <!DOCTYPE html>
        <meta charset="utf-8" />
        <link rel="icon" href="data:," />
        <link href="${baseUrl}/entry.css?${revision}" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="handshake_url" value="${handlerUrl}?auth=handshake" />
        <meta name="redirect_url" value="${handlerUrl}?auth=login" />
        <body>
          <script type="module">
            import {boot} from '${baseUrl}/entry.js?${revision}'
            boot('${handlerUrl}')
          </script>
        </body>
      `.toString()
  )
}
