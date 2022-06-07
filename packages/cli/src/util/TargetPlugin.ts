import {Plugin} from 'esbuild'
import crypto from 'node:crypto'
import path from 'node:path'
import {externalPlugin} from './ExternalPlugin'
import {ignorePlugin} from './IgnorePlugin'

type FileInfo = (file: string) => {
  packageName: string
  packageRoot: string
}

type EntryPoint = {entryPoint: string; outputFile: string}

export function targetPlugin(info: FileInfo): Plugin {
  return {
    name: 'target',
    setup(build) {
      const outputs = new Map<string, Array<EntryPoint>>()
      const extension = build.initialOptions.outExtension?.['.js'] || '.js'
      build.onStart(() => {
        outputs.clear()
      })
      // Hook into any import that ends in .(server|client).(js/ts)
      // compile and place the file in the target directory
      build.onResolve(
        {filter: /\.(server|client)(\.[mc]?[tj]sx?)?$/},
        async args => {
          const entryPoint = path.join(args.resolveDir, args.path)
          const {packageName, packageRoot} = info(entryPoint)
          // We'll not keep the directory structure around but create a small
          // hash to avoid file name collisions
          const hash = crypto
            .createHash('md5')
            .update(args.resolveDir)
            .digest('hex')
            .slice(0, 7)
          const hasExtension = /\.[mc]?[tj]sx?$/.test(args.path)
          const file = path.basename(
            hasExtension
              ? args.path.split('.').slice(0, -1).join('.')
              : args.path
          )
          const target = file.split('.').pop()!
          const outputFile = file + '.' + hash
          const outDir = path.join(packageRoot, `.${target}/dist`)
          const output = outputs.get(outDir) || []
          output.push({entryPoint, outputFile})
          outputs.set(outDir, output)
          return {
            external: true,
            path: `${packageName}/.${target}/${outputFile}${extension}`
          }
        }
      )

      build.onEnd(() => {
        const tasks = []
        for (const [outDir, output] of outputs) {
          const platform = outDir.includes('.server') ? 'node' : 'browser'
          tasks.push(
            build.esbuild.build({
              platform,
              bundle: true,
              format: 'esm',
              target: 'esnext',
              treeShaking: true,
              splitting: true,
              entryPoints: Object.fromEntries(
                output.map(entry => [entry.outputFile, entry.entryPoint])
              ),
              outdir: outDir,
              plugins: [externalPlugin, ignorePlugin]
            })
          )
        }
        return Promise.all(tasks).then(() => void 0)
      })
    }
  }
}
