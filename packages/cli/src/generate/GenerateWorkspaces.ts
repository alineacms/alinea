import {Config} from '@alinea/core/Config'
import {Workspace} from '@alinea/core/Workspace'
import fs from 'fs-extra'
import path from 'node:path'
import {GenerateContext} from './GenerateContext'

import {code} from '@alinea/cli/util/CodeGen'
import {copyFileIfContentsDiffer, writeFileIfContentsDiffer} from '../util/FS'

function wrapNamespace(code: string, namespace: string | undefined) {
  if (namespace) return `export namespace ${namespace} {\n${code}\n}`
  return code
}

function schemaCollections(workspace: Workspace) {
  const typeNames = workspace.schema.keys
  const collections = workspace.typeNamespace
    ? `export const ${workspace.typeNamespace} = {
      AnyPage: schema.collection(),
      ${typeNames
        .map(type => `${type}: schema.type('${type}').collection()`)
        .join(',\n')}
    }`
    : `
    export const AnyPage = schema.collection()
    ${typeNames
      .map(type => `export const ${type} = schema.type('${type}').collection()`)
      .join('\n')}
  `
  return code`
    import {config} from '../config.js'
    export const workspace = config.workspaces['${workspace.name}']
    export const schema = workspace.schema
    ${collections}
  `
}

function schemaTypes(workspace: Workspace) {
  const typeNames = workspace.schema.keys
  const collections = `export type AnyPage = EntryOf<Entry & typeof schema>
  export const AnyPage: Collection<AnyPage>
  export type Pages = AlineaPages<AnyPage>
  ${typeNames
    .map(
      type =>
        `export const ${type}: Collection<Extract<AnyPage, {type: '${type}'}>>
        export type ${type} = DataOf<typeof ${type}>`
    )
    .join('\n')}`
  return code`
    import {config} from '../config.js'
    import {DataOf, EntryOf, Entry} from '@alinea/core'
    import {Collection} from '@alinea/store'
    import type {Pages as AlineaPages} from '@alinea/backend'
    export const schema: (typeof config)['workspaces']['${
      workspace.name
    }']['schema']
    ${wrapNamespace(collections, workspace.typeNamespace)}
  `
}

function pagesType(workspace: Workspace) {
  return code`
    import {${workspace.typeNamespace || 'Pages'}} from './schema.js'
    export const initPages: (previewToken?: string) => ${
      workspace.typeNamespace ? `${workspace.typeNamespace}.` : ''
    }Pages
  `
}

function pagesOf(workspace: Workspace) {
  return code`
    import {backend} from '../backend.js'
    export function initPages(previewToken) {
      return backend.loadPages('${workspace.name}', {
        previewToken
      })
    }
  `
}

export async function generateWorkspaces(
  {staticDir, outDir}: GenerateContext,
  config: Config
) {
  for (const [key, workspace] of Object.entries(config.workspaces)) {
    function copy(...files: Array<string>) {
      return Promise.all(
        files.map(file =>
          copyFileIfContentsDiffer(
            path.join(staticDir, 'workspace', file),
            path.join(outDir, key, file)
          )
        )
      )
    }
    await Promise.all([
      fs.mkdir(path.join(outDir, key), {recursive: true}),
      writeFileIfContentsDiffer(
        path.join(outDir, key, 'schema.js'),
        schemaCollections(workspace)
      ),
      writeFileIfContentsDiffer(
        path.join(outDir, key, 'schema.d.ts'),
        schemaTypes(workspace)
      ),
      copy('index.d.ts', 'index.js', 'pages.cjs'),
      writeFileIfContentsDiffer(
        path.join(outDir, key, 'pages.js'),
        pagesOf(workspace)
      ),
      writeFileIfContentsDiffer(
        path.join(outDir, key, 'pages.d.ts'),
        pagesType(workspace)
      )
    ])
  }
  const pkg = JSON.parse(
    await fs.readFile(path.join(staticDir, 'package.json'), 'utf8')
  )
  await writeFileIfContentsDiffer(
    path.join(outDir, 'package.json'),
    JSON.stringify(
      {
        ...pkg,
        exports: {
          ...pkg.exports,
          ...Object.fromEntries(
            Object.keys(config.workspaces).flatMap(key => [
              [`./${key}`, `./${key}/index.js`],
              [
                `./${key}/pages.js`,
                {
                  require: `./${key}/pages.cjs`,
                  default: `./${key}/pages.js`
                }
              ],
              [`./${key}/*`, `./${key}/*`]
            ])
          )
        }
      },
      null,
      '  '
    )
  )
}
