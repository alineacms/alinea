import {type} from '#/core/Type.js'
import {text} from '#/field/text/TextField.js'
import type {IndexedEntry} from '#/database/entry/Schema.js'
import type {ReplicaIdentity} from '#/database/browser/ReplicaCache.js'

export const replicaIdentity: ReplicaIdentity = {
  project: 'browser-fixture',
  namespace: 'main',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'config',
  principal: 'fixture-user',
  viewId: 'view',
  releaseId: 'release'
}

export const Page = type('Page', {fields: {title: text('Title')}})
export const config = {schema: {Page}, workspaces: {}}
export function entry(id: string, title = id): IndexedEntry {
  return {
    id,
    title,
    locale: null,
    versionStatus: 'published',
    status: 'published',
    type: 'Page',
    workspace: 'main',
    root: 'pages',
    parentId: null,
    parents: [],
    level: 0,
    index: id,
    path: id,
    url: `/${id}`,
    active: true,
    main: true,
    seeded: null,
    rowHash: title
  }
}
