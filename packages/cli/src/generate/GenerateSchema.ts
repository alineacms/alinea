import {Config} from '@alinea/core/Config'
import {code} from '@alinea/core/util/CodeGen'
import path from 'node:path'
import {writeFileIfContentsDiffer} from '../util/FS'
import {GenerateContext} from './GenerateContext'
import {generateTypes} from './GenerateTypes'

function schemaCollections(config: Config) {
  const typeNames = config.schema.keys
  const collections = config.typeNamespace
    ? code`
      export const ${config.typeNamespace} = {
        AnyPage: schema.collection(),
        ${typeNames
          .map(type => `${type}: schema.type('${type}').collection()`)
          .join(',\n')}
      }
    `
    : code`
      export const AnyPage = schema.collection()
      ${typeNames
        .map(
          type => `export const ${type} = schema.type('${type}').collection()`
        )
        .join('\n')}
    `
  return code`
    import {config} from '../config.js'
    const schema = config.schema
    ${collections}
  `
}

function pagesType(config: Config) {
  return code`
    import {${config.typeNamespace || 'Pages'}} from './schema.js'
    import type {Pages as AlineaPages} from '@alinea/backend'
    export const initPages: (previewToken?: string) => AlineaPages<${
      config.typeNamespace ? `${config.typeNamespace}.` : ''
    }AnyPage>
  `
}

function pagesOf() {
  return code`
    import {backend} from '../backend.js'
    export function initPages(previewToken) {
      return backend.loadPages({previewToken})
    }
  `
}

export async function generateSchema(
  {staticDir, outDir}: GenerateContext,
  config: Config
) {
  await Promise.all([
    writeFileIfContentsDiffer(
      path.join(outDir, 'schema.js'),
      schemaCollections(config).toString()
    ),
    writeFileIfContentsDiffer(
      path.join(outDir, 'schema.d.ts'),
      generateTypes(config).toString()
    )
  ])
}
