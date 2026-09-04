import fs from 'node:fs/promises'
import path from 'node:path'
import type {GenerateContext} from './GenerateContext.js'

const packageJson = {
  private: true,
  version: '0.0.0',
  name: '@alinea/generated',
  type: 'module',
  sideEffects: false,
  exports: {
    './package.json': './package.json',
    './server-config.js': './server-config.js',
    './runtime-index.js': {
      'edge-light': './empty-runtime-index.js',
      default: './runtime-index.js'
    }
  }
}

export interface GeneratedSecrets {
  releaseId: string
  configId: string
}

export interface CopyStaticFilesOptions {
  preserveRuntimeIndex?: boolean
}

export async function copyStaticFiles(
  {bundleDir}: GenerateContext,
  options: CopyStaticFilesOptions = {}
) {
  await fs.mkdir(bundleDir, {recursive: true})
  const runtimeIndex = path.join(bundleDir, 'runtime-index.js')
  const emptyRuntimeIndex =
    'export default {revision:"",bundleId:"",bundleUrl:"",entries:[]}'
  const writes = [
    fs.writeFile(
      path.join(bundleDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    ),
    fs.writeFile(
      path.join(bundleDir, 'empty-runtime-index.js'),
      emptyRuntimeIndex
    )
  ]
  if (!options.preserveRuntimeIndex || !(await exists(runtimeIndex)))
    writes.push(fs.writeFile(runtimeIndex, emptyRuntimeIndex))
  await Promise.all(writes)
}

async function exists(location: string): Promise<boolean> {
  return fs.access(location).then(
    () => true,
    () => false
  )
}
