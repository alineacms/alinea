import {entries, fromEntries, isRecord, values} from '#/core/util/Objects.js'
import {withOrderKeys} from '#/core/util/OrderKeys.js'
import type {Getter, PrimitiveAtom, Setter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import type {SetStateAction} from 'react'
import {dispense} from './utils.js'

export type Writable<Value> = WritableAtom<Value, [SetStateAction<Value>], void>
export type Peek<Value> = WritableAtom<null, [], Value>

function isArray<Value>(input: unknown): input is Array<Value> {
  return Array.isArray(input)
}

type ReactiveObject = Record<string, ReactiveNode>

interface Rebase<Value> {
  checkpoint: Value
  saved: Value
}

const USE_SAVED = Symbol('use saved value')

function rebaseValue(
  checkpoint: unknown,
  edited: unknown,
  saved: unknown
): unknown {
  if (Object.is(checkpoint, edited) || Object.is(edited, saved)) {
    return USE_SAVED
  }
  if (isArray(checkpoint) && isArray(edited)) {
    const savedItems = isArray(saved) ? saved : []
    const result = []
    let changed = false
    const length = Math.max(checkpoint.length, edited.length, savedItems.length)
    for (let index = 0; index < length; index++) {
      const value = rebaseValue(
        checkpoint[index],
        edited[index],
        savedItems[index]
      )
      if (value === USE_SAVED) {
        if (index < savedItems.length) result.push(savedItems[index])
      } else {
        changed = true
        if (value !== undefined) result.push(value)
      }
    }
    return changed ? result : USE_SAVED
  }
  if (isRecord(checkpoint) && isRecord(edited)) {
    const savedFields = isRecord(saved) ? saved : {}
    const result = {...savedFields}
    let changed = false
    const keys = new Set([
      ...Object.keys(checkpoint),
      ...Object.keys(edited),
      ...Object.keys(savedFields)
    ])
    for (const key of keys) {
      const value = rebaseValue(checkpoint[key], edited[key], savedFields[key])
      if (value === USE_SAVED) continue
      changed = true
      if (value === undefined) delete result[key]
      else result[key] = value
    }
    return changed ? result : USE_SAVED
  }
  return edited
}

function resolveUpdate<Value>(
  update: SetStateAction<Value>,
  current: Value
): Value {
  return typeof update === 'function'
    ? (update as (value: Value) => Value)(current)
    : update
}

/**
 * List rows written by the editor get a fractional `_index` order key between
 * their neighbours where theirs is missing or out of order, like the stored
 * content expects. Rows with keys in order keep them.
 */
function ordered(value: unknown): unknown {
  return isArray(value) ? withOrderKeys(value) : value
}

export class ReactiveNode<Value = unknown> {
  #initialValue: PrimitiveAtom<Value>
  readonly readOnly: boolean
  nodes: WritableAtom<unknown, [unknown], void>
  #inner = atom(get => {
    const nodes = get(this.nodes)
    if (isArray<ReactiveNode>(nodes)) return nodes
    if (isRecord(nodes)) return values(nodes) as Array<ReactiveNode>
    return []
  })
  value: Writable<Value>
  peek: Peek<Value> = atom(null, get => get(this.value))

  constructor(initialValue: Value, readOnly = false) {
    this.#initialValue = atom(initialValue)
    this.readOnly = readOnly
    this.nodes = atom(this.#wrap(initialValue))
    this.value = atom(this.#read, this.#write)
  }

  #read = (get: Getter) => this.#unwrap(get, get(this.nodes)) as Value

  #write = (get: Getter, set: Setter, update: SetStateAction<Value>) => {
    if (this.readOnly) return
    this.#assign(get, set, resolveUpdate(update, get(this.value)), true)
  }

  /**
   * Editor writes (`order`) assign order keys to list rows, persisted data
   * written through commit, rebase and reset is kept exactly as it is.
   */
  #assign(get: Getter, set: Setter, value: unknown, order: boolean) {
    const next = order ? ordered(value) : value
    this.#reconcile(get, set, next, order)
    set(this.#dirty, next !== get(this.#initialValue))
  }

  isEmpty = atom(get => get(this.value) === undefined)
  #dirty = atom(false)
  isDirty: WritableAtom<boolean, [false], void> = atom(
    get => get(this.#dirty) || get(this.#inner).some(node => get(node.isDirty)),
    (get, set, value: false) => {
      if (!get(this.isDirty)) return
      set(this.#dirty, value)
      for (const node of get(this.#inner)) set(node.isDirty, value)
    }
  )

  #wrap(value: unknown): unknown {
    if (isArray(value))
      return value.map(item => new ReactiveNode(item, this.readOnly))
    if (isRecord(value))
      return fromEntries(
        entries(value).map(([key, item]) => [
          key,
          new ReactiveNode(item, this.readOnly)
        ])
      )
    return value
  }

  #unwrap(get: Getter, nodes: unknown): unknown {
    if (isArray<ReactiveNode>(nodes)) return nodes.map(node => get(node.value))
    if (isRecord(nodes))
      return fromEntries(
        entries(nodes as ReactiveObject).map(([key, node]) => [
          key,
          get(node.value)
        ])
      )
    return nodes
  }

  #reconcile(get: Getter, set: Setter, next: unknown, order: boolean) {
    const current = get(this.nodes)
    if (isArray(next) && isArray<ReactiveNode>(current)) {
      let changed = current.length !== next.length
      const nextStructure: Array<ReactiveNode> = []
      for (let index = 0; index < next.length; index++) {
        const node = current[index]
        if (node) {
          node.#assign(get, set, next[index], order)
          nextStructure.push(node)
        } else {
          changed = true
          nextStructure.push(new ReactiveNode(next[index], this.readOnly))
        }
      }
      if (changed) set(this.nodes, nextStructure)
      return
    }
    if (isRecord(next) && isRecord(current)) {
      let changed = false
      const fields = current as ReactiveObject
      const nextStructure = {...fields}
      for (const key of Object.keys(current)) {
        if (!(key in next)) {
          delete nextStructure[key]
          changed = true
        } else {
          fields[key].#assign(get, set, next[key], order)
        }
      }
      for (const key of Object.keys(next)) {
        if (!fields[key]) {
          nextStructure[key] = new ReactiveNode(next[key], this.readOnly)
          changed = true
        }
      }
      if (changed) set(this.nodes, nextStructure)
      return
    }
    if (current !== next) set(this.nodes, this.#wrap(next))
  }

  reset = atom(null, (get, set) => {
    if (!this.readOnly) this.#assign(get, set, get(this.#initialValue), false)
    set(this.isDirty, false)
  })

  commit = atom(null, (get, set, data?: Value): Value => {
    if (data !== undefined && !this.readOnly)
      this.#assign(get, set, data, false)
    for (const node of get(this.#inner)) set(node.commit)
    const value = get(this.value)
    set(this.#initialValue, value)
    set(this.#dirty, false)
    return value
  })

  rebase = atom(null, (get, set, {checkpoint, saved}: Rebase<Value>): Value => {
    const edited = get(this.value)
    const rebased = rebaseValue(checkpoint, edited, saved)
    set(this.commit, saved)
    if (rebased !== USE_SAVED && !this.readOnly)
      this.#assign(get, set, rebased, false)
    return get(this.value)
  })

  field = dispense(
    (key: string): Writable<unknown> =>
      atom(
        get => {
          const structure = get(this.nodes)
          const fields = isRecord(structure)
            ? (structure as ReactiveObject)
            : undefined
          return fields?.[key] ? get(fields[key].value) : undefined
        },
        (get, set, update) => {
          if (this.readOnly) return
          const structure = get(this.nodes)
          if (isRecord(structure)) {
            const fields = structure as ReactiveObject
            if (fields[key]) set(fields[key].value, update)
            else {
              const next = ordered(resolveUpdate(update, undefined))
              set(this.nodes, {
                ...fields,
                [key]: new ReactiveNode(next, this.readOnly)
              })
              set(this.#dirty, true)
            }
            return
          }
          const next = ordered(resolveUpdate(update, undefined))
          set(this.nodes, {[key]: new ReactiveNode(next, this.readOnly)})
          set(this.#dirty, true)
        }
      )
  )

  /**
   * Replace the list structure with `next`, giving the rows at `rekey` (the
   * inserted or moved rows) a new order key between their neighbours. Rows
   * whose key is missing or out of order are repaired, other rows keep theirs.
   */
  #restructure(
    get: Getter,
    set: Setter,
    next: Array<ReactiveNode | {value: unknown}>,
    rekey: ReadonlySet<number>
  ) {
    const rows = next.map(item =>
      item instanceof ReactiveNode ? get(item.value) : item.value
    )
    const keyed = withOrderKeys(rows, rekey)
    set(
      this.nodes,
      next.map((item, index) => {
        if (!(item instanceof ReactiveNode))
          return new ReactiveNode(keyed[index], this.readOnly)
        if (keyed[index] !== rows[index])
          set(item.field('_index'), (keyed[index] as {_index: string})._index)
        return item
      })
    )
    set(this.#dirty, true)
  }

  push = atom(null, (get, set, value: unknown) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray<ReactiveNode>(structure)) return
    this.#restructure(
      get,
      set,
      [...structure, {value}],
      new Set([structure.length])
    )
  })

  insert = atom(null, (get, set, index: number, value: unknown) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray<ReactiveNode>(structure)) return
    const next: Array<ReactiveNode | {value: unknown}> = [...structure]
    const insertAt = Math.max(0, Math.min(index, next.length))
    next.splice(insertAt, 0, {value})
    this.#restructure(get, set, next, new Set([insertAt]))
  })

  remove = atom(null, (get, set, index: number) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    set(
      this.nodes,
      structure.filter((_, current) => current !== index)
    )
    set(this.#dirty, true)
  })

  move = atom(null, (get, set, from: number, to: number) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray<ReactiveNode>(structure)) return
    const next = [...structure]
    const [item] = next.splice(from, 1)
    if (item === undefined) return
    const moveTo = Math.max(0, Math.min(to, next.length))
    if (moveTo === from) return
    next.splice(moveTo, 0, item)
    this.#restructure(get, set, next, new Set([moveTo]))
  })
}
