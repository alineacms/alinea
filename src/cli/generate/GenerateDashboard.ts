import {buildOptions} from 'alinea/cli/build/BuildOptions'
import {writeFileIfContentsDiffer} from 'alinea/cli/util/FS'
import {publicDefines} from 'alinea/cli/util/PublicDefines'
import {createError} from 'alinea/core/ErrorWithCode'
import {code} from 'alinea/core/util/CodeGen'
import {build} from 'esbuild'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {GenerateContext} from './GenerateContext.js'

const require = createRequire(import.meta.url)

export async function generateDashboard(
  {rootDir, configDir, staticDir}: GenerateContext,
  handlerUrl: string,
  staticFile: string
) {
  if (!staticFile.endsWith('.html'))
    throw createError(
      `The staticFile option in config.dashboard must point to an .html file (include the extension)`
    )
  const entryPoints = {
    entry: 'alinea/cli/static/dashboard/entry',
    config: '@alinea/generated/config.js'
  }
  const basename = path.basename(staticFile, '.html')
  const assetsFolder = path.join(path.dirname(staticFile), basename)
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
    define: {
      'process.env.NODE_ENV': "'production'",
      ...publicDefines(process.env)
    },
    ...buildOptions,
    tsconfig,
    logLevel: 'error'
  }).catch(e => {
    throw 'Could not compile entrypoint'
  })
  await writeFileIfContentsDiffer(
    path.join(configDir, staticFile),
    code`
        <!DOCTYPE html>
        <meta charset="utf-8" />
        <link rel="icon" href="data:," />
        <link href="./${basename}/entry.css" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="handshake_url" value="${handlerUrl}/hub/auth/handshake" />
        <meta name="redirect_url" value="${handlerUrl}/hub/auth" />
        <body>
          <script type="module">
            import {boot} from './${basename}/entry.js'
            boot('${handlerUrl}')
          </script>
        </body>
      `.toString()
  )
}
