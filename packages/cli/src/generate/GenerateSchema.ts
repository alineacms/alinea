import {Config} from '@alinea/core/Config'
import path from 'node:path'
import {writeFileIfContentsDiffer} from '../util/FS'
import {GenerateContext} from './GenerateContext'
import {generateTypes} from './GenerateTypes'

export async function generateSchema(
  {outDir}: GenerateContext,
  config: Config
) {
  return writeFileIfContentsDiffer(
    path.join(outDir, 'schema.d.ts'),
    generateTypes(config).toString()
  )
}
