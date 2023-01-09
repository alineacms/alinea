import {Config} from '@alinea/core/Config'
import path from 'node:path'
import {writeFileIfContentsDiffer} from '../util/FS'
import {GenerateContext} from './GenerateContext'
import {generateGraphQL} from './GenerateGraphQL'
import {generateTypes} from './GenerateTypes'

export async function generateSchema(
  {outDir}: GenerateContext,
  config: Config
): Promise<void> {
  await Promise.all([
    writeFileIfContentsDiffer(
      path.join(outDir, 'schema.d.ts'),
      generateTypes(config.schema).toString()
    ),
    writeFileIfContentsDiffer(
      path.join(outDir, 'schema.graphql'),
      generateGraphQL(config.schema)
    )
  ])
}
