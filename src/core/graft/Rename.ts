import type {Json, JsonObject, MaybeJson, Shape} from '@alinea/graft'
import {dequal} from 'dequal'

type Pair = [base: MaybeJson, ours: MaybeJson]

/**
 * Moves what a save wrote under old field names to their current name, in
 * the save and in the base it was made from. A dashboard on an older schema
 * keeps the value under the current name as it read it and edits the old
 * one, so an old name that changed is the edit, where graft's merge would
 * keep the value under the current name. Old names left as they were are
 * moved as the merge moves them.
 */
export function renameEdits(
  shape: Shape,
  base: MaybeJson,
  ours: MaybeJson
): Pair {
  if (ours === undefined) return [base, ours]
  switch (shape.kind) {
    case 'record': {
      if (!isObject(ours)) return [base, ours]
      let [b, o] = [isObject(base) ? base : undefined, ours]
      for (const [from, to] of Object.entries(shape.renamed))
        [b, o] = renameField(b, o, from, to)
      const fields = Object.entries(o).map(([key, value]): [string, Json] => {
        const inner = Object.hasOwn(shape.fields, key)
          ? shape.fields[key]!
          : shape.rest
        const [nextBase, next] = renameEdits(inner, b?.[key], value)
        if (b && nextBase !== undefined) b = {...b, [key]: nextBase as Json}
        return [key, next as Json]
      })
      return [b, Object.fromEntries(fields)]
    }
    case 'map': {
      if (!isObject(ours)) return [base, ours]
      const b = isObject(base) ? {...base} : undefined
      const fields = Object.entries(ours).map(
        ([key, value]): [string, Json] => {
          const [nextBase, next] = renameEdits(shape.values, b?.[key], value)
          if (b && nextBase !== undefined) b[key] = nextBase as Json
          return [key, next as Json]
        }
      )
      return [b, Object.fromEntries(fields)]
    }
    case 'union': {
      if (shape.tag.kind !== 'field' || !isObject(ours)) return [base, ours]
      const name = ours[shape.tag.field]
      const variant =
        typeof name === 'string' && Object.hasOwn(shape.variants, name)
          ? shape.variants[name]!
          : shape.fallback
      const sameVariant =
        isObject(base) && base[shape.tag.field] === ours[shape.tag.field]
      return renameEdits(variant, sameVariant ? base : undefined, ours)
    }
    case 'list': {
      if (!Array.isArray(ours) || shape.identity.kind !== 'key')
        return [base, ours]
      return renameItems(shape.item, shape.identity.key, base, ours)
    }
    case 'richText': {
      if (!Array.isArray(ours) || !shape.embedId) return [base, ours]
      return renameNodes(shape, base, ours)
    }
    default:
      return [base, ours]
  }
}

function renameField(
  base: JsonObject | undefined,
  ours: JsonObject,
  from: string,
  to: string
): [JsonObject | undefined, JsonObject] {
  const edited =
    Object.hasOwn(ours, from) &&
    !(base && Object.hasOwn(base, from) && dequal(base[from], ours[from]))
  if (!edited) return [base && moved(base, from, to), moved(ours, from, to)]
  const {[from]: value, ...rest} = ours
  return [base && moved(base, from, to), {...rest, [to]: value!}]
}

/** A value under an old name moved to the current one, unless it is taken */
function moved(value: JsonObject, from: string, to: string): JsonObject {
  if (!Object.hasOwn(value, from)) return value
  const {[from]: old, ...rest} = value
  return Object.hasOwn(rest, to) ? rest : {...rest, [to]: old!}
}

function renameItems(
  item: Shape,
  key: string,
  base: MaybeJson,
  ours: Array<Json>
): Pair {
  const baseItems = Array.isArray(base) ? base : []
  const byKey = new Map(
    baseItems.flatMap(value =>
      isObject(value) && typeof value[key] === 'string'
        ? [[value[key], value] as const]
        : []
    )
  )
  const renamed = new Map<Json, MaybeJson>()
  const items = ours.map(value => {
    const id = isObject(value) ? value[key] : undefined
    const match = typeof id === 'string' ? byKey.get(id) : undefined
    const [nextBase, next] = renameEdits(item, match, value)
    if (match) renamed.set(match, nextBase)
    return next as Json
  })
  const nextBase = Array.isArray(base)
    ? base.map(value => (renamed.get(value) ?? value) as Json)
    : base
  return [nextBase, items]
}

function renameNodes(
  shape: Extract<Shape, {kind: 'richText'}>,
  base: MaybeJson,
  ours: Array<Json>
): Pair {
  const id = shape.embedId!
  const embeds = new Map<string, JsonObject>()
  const collect = (nodes: MaybeJson) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!isObject(node)) continue
      if (typeof node[id] === 'string') embeds.set(node[id], node)
      collect(node[shape.content])
    }
  }
  collect(base)
  const renamed = new Map<JsonObject, MaybeJson>()
  const walk = (nodes: Array<Json>): Array<Json> =>
    nodes.map(node => {
      if (!isObject(node)) return node
      const type = node[shape.type]
      if (typeof type === 'string' && Object.hasOwn(shape.embeds, type)) {
        const match =
          typeof node[id] === 'string' ? embeds.get(node[id]) : undefined
        const [nextBase, next] = renameEdits(shape.embeds[type]!, match, node)
        if (match) renamed.set(match, nextBase)
        return next as Json
      }
      const content = node[shape.content]
      if (!Array.isArray(content)) return node
      return {...node, [shape.content]: walk(content)}
    })
  const result = walk(ours)
  const rebuild = (nodes: Array<Json>): Array<Json> =>
    nodes.map(node => {
      if (!isObject(node)) return node
      if (renamed.has(node)) return renamed.get(node) as Json
      const content = node[shape.content]
      if (!Array.isArray(content)) return node
      return {...node, [shape.content]: rebuild(content)}
    })
  return [Array.isArray(base) ? rebuild(base) : base, result]
}

function isObject(value: MaybeJson): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
