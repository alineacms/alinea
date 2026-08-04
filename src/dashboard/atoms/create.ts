import {Entry} from '#/core/Entry.js'
import {MediaLibrary} from '#/core/media/MediaTypes.js'
import {Permission} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {slugify} from '#/core/util/Slugs.js'
import {atom} from 'jotai'
import {configAtom, graphAtom} from './core.js'
import {routeAtom} from './nav.js'
import type {PageAuth} from './nav.js'
import {dispense} from './utils.js'

export interface CreateEntryRequest {
  workspace: string
  root: string
  locale: string | null
  type: string
  title: string
  parentId?: string
  copyFrom?: string
  insertOrder?: 'first' | 'last'
}

export const createEntryAtom = dispense((auth: PageAuth) =>
  atom(null, async (get, set, request: CreateEntryRequest) => {
    const {policy, user} = auth
    const config = get(configAtom)
    const graph = get(graphAtom)
    const type = config.schema[request.type]
    assert(type, `Type "${request.type}" not found in config`)
    const title = request.title.trim()
    assert(title, 'Title is required')
    const copiedData = request.copyFrom
      ? await graph.first({
          select: Entry.data,
          id: request.copyFrom,
          locale: request.locale,
          status: 'preferPublished'
        })
      : undefined
    const parent = request.parentId
      ? await graph.first({
          select: {type: Entry.type, parents: Entry.parents},
          id: request.parentId,
          status: 'preferDraft'
        })
      : undefined
    const parentType = parent ? config.schema[parent.type] : undefined
    const parentInsertOrder = parentType && Type.insertOrder(parentType)
    policy.assert(Permission.Create, {
      workspace: request.workspace,
      root: request.root,
      locale: request.locale,
      type: request.type,
      parents: request.parentId
        ? [request.parentId, ...(parent?.parents ?? [])]
        : []
    })
    const initialData = Type.withInitialValue(type, {
      ...Type.initialValue(type),
      ...copiedData,
      title,
      path: slugify(title)
    })
    const data = Type.beforeSave(type, initialData, {
      action: 'create',
      user,
      now: new Date()
    })
    const created = await graph.create({
      type,
      workspace: request.workspace,
      root: request.root,
      parentId: request.parentId,
      locale: request.locale,
      status:
        type === MediaLibrary || !config.enableDrafts ? 'published' : 'draft',
      insertOrder:
        parentInsertOrder && parentInsertOrder !== 'free'
          ? parentInsertOrder
          : request.insertOrder,
      set: data
    })
    set(routeAtom, {
      workspace: request.workspace,
      root: request.root,
      entry: created._id,
      locale: request.locale ?? undefined
    })
    return created
  })
)
