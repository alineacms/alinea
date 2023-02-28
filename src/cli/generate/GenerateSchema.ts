import {Config} from 'alinea/core/Config'
import path from 'node:path'
import {writeFileIfContentsDiffer} from '../util/FS.js'
import {GenerateContext} from './GenerateContext.js'
import {generateTypes} from './GenerateTypes.js'

export async function generateSchema(
  {outDir}: GenerateContext,
  config: Config
) {
  return writeFileIfContentsDiffer(
    path.join(outDir, 'schema.d.ts'),
    generateTypes(config).toString()
  )
}
