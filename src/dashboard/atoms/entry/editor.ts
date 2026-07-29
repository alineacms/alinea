import {Field, type EntryAnchorTarget, type FieldOptions} from '#/core/Field.js'
import {getType} from '#/core/Internal.js'
import type {Resource} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {Section as ConfigSection} from '#/core/Section.js'
import {FieldGetter, optionTrackerOf} from '#/core/Tracker.js'
import {Type as ConfigType} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {entries, fromEntries, isRecord, values} from '#/core/util/Objects.js'
import type {Atom, Getter, Setter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import type {ComponentType, SetStateAction} from 'react'
import {policyAtom} from '../user.js'
import {dispense} from '../utils.js'
import {configAtom, viewAtom} from '../config.js'

export type Writable<Value> = WritableAtom<Value, [SetStateAction<Value>], void>
export type Peek<Value> = WritableAtom<null, [], Value>

function isArray<Value = unknown>(input: unknown): input is Array<Value> {
  return Array.isArray(input)
}

type ReactiveObject = Record<string, ReactiveNode>

export class ReactiveNode<Value = unknown> {
  #initialValue: Value
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
    this.#initialValue = initialValue
    this.readOnly = readOnly
    this.nodes = atom(this.#wrap(initialValue))
    this.value = atom(this.#read, this.#write)
  }

  #read = (get: Getter) => {
    return this.#unwrap(get, get(this.nodes)) as Value
  }

  #write = (get: Getter, set: Setter, update: SetStateAction<Value>) => {
    if (this.readOnly) return
    const next =
      typeof update === 'function'
        ? (update as (value: Value) => Value)(get(this.value))
        : update
    this.#reconcile(get, set, next)
    const isChanged = next === this.#initialValue
    set(this.#dirty, !isChanged)
  }

  isEmpty = atom(get => get(this.value) === undefined)
  #dirty = atom(false)
  isDirty = atom(
    (get): boolean => {
      const dirty = get(this.#dirty)
      if (dirty) return true
      return get(this.#inner).some(node => get(node.isDirty))
    },
    (get, set, _value: false) => {
      const isDirty = get(this.isDirty)
      if (!isDirty) return
      set(this.#dirty, false)
      for (const node of get(this.#inner)) set(node.isDirty, false)
    }
  )

  #wrap(value: unknown): unknown {
    if (isArray(value))
      return value.map(item => new ReactiveNode(item, this.readOnly))
    if (isRecord(value)) {
      return fromEntries(
        entries(value).map(([key, item]) => [
          key,
          new ReactiveNode(item, this.readOnly)
        ])
      )
    }
    return value
  }

  #unwrap(get: Getter, nodes: unknown): unknown {
    if (isArray<ReactiveNode>(nodes)) return nodes.map(node => get(node.value))
    if (isRecord(nodes)) {
      return fromEntries(
        entries(nodes as ReactiveObject).map(([key, node]) => [
          key,
          get(node.value)
        ])
      )
    }
    return nodes
  }

  #reconcile(get: Getter, set: Setter, next: unknown) {
    const current = get(this.nodes)

    if (isArray(next) && isArray(current)) {
      let changed = current.length !== next.length
      const nextStructure = []
      for (let index = 0; index < next.length; index++) {
        const value = next[index]
        if (current[index]) {
          set((current[index] as ReactiveNode).value, value)
          nextStructure.push(current[index])
        } else {
          changed = true
          nextStructure.push(new ReactiveNode(value, this.readOnly))
        }
      }
      if (changed) set(this.nodes, nextStructure)
    } else if (isRecord(next) && isRecord(current)) {
      let changed = false
      const nextStructure = {...current} as Record<string, ReactiveNode>
      for (const key of Object.keys(current)) {
        if (!(key in next)) {
          delete nextStructure[key]
          changed = true
        } else {
          set((current[key] as ReactiveNode).value, next[key])
        }
      }
      for (const key of Object.keys(next)) {
        if (!current[key]) {
          changed = true
          nextStructure[key] = new ReactiveNode(next[key], this.readOnly)
        }
      }
      if (changed) set(this.nodes, nextStructure)
    } else if (current !== next) {
      set(this.nodes, this.#wrap(next))
    }
  }

  reset = atom(null, (get, set): void => {
    set(this.value, this.#initialValue)
    set(this.isDirty, false)
  })

  commit = atom(null, (get, set): Value => {
    for (const node of get(this.#inner)) set(node.commit)
    this.#initialValue = get(this.value)
    set(this.#dirty, false)
    return this.#initialValue
  })

  field = dispense((key: string): Writable<unknown> => {
    return atom(
      get => {
        const structure = get(this.nodes)
        const field = isRecord(structure)
          ? (structure[key] as ReactiveNode | undefined)
          : undefined
        return field ? get(field.value) : undefined
      },
      (get, set, update) => {
        if (this.readOnly) return
        const structure = get(this.nodes)
        if (isRecord(structure)) {
          const fields = structure as ReactiveObject
          if (fields[key]) set(fields[key].value, update)
          else {
            set(this.nodes, {
              ...fields,
              [key]: new ReactiveNode(update, this.readOnly)
            })
            set(this.#dirty, true)
          }
        } else {
          set(this.nodes, {
            [key]: new ReactiveNode(update, this.readOnly)
          })
          set(this.#dirty, true)
        }
      }
    )
  })

  push = atom(null, (get, set, value: unknown) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    set(this.nodes, [...structure, new ReactiveNode(value, this.readOnly)])
    set(this.#dirty, true)
  })

  insert = atom(null, (get, set, index: number, value: unknown) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    const next = [...structure]
    const insertAt = Math.max(0, Math.min(index, next.length))
    next.splice(insertAt, 0, new ReactiveNode(value, this.readOnly))
    set(this.nodes, next)
    set(this.#dirty, true)
  })

  remove = atom(null, (get, set, index: number) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    set(
      this.nodes,
      structure.filter((_, currentIndex) => currentIndex !== index)
    )
    set(this.#dirty, true)
  })

  move = atom(null, (get, set, from: number, to: number) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    const next = [...structure]
    next.splice(to, 0, next.splice(from, 1)[0])
    set(this.nodes, next)
    set(this.#dirty, true)
  })
}

export interface EditorAtoms {
  type: ConfigType
  node: ReactiveNode<object>
  parent?: EditorAtoms
  resource?: Resource
  value: Atom<object>
  anchors: Atom<Array<EntryAnchorTarget>>
  sections: Array<SectionAtoms>
  field(key: string): FieldAtoms | undefined
  get(field: Field): FieldAtoms | undefined
}

export function rootEditor(editor: EditorAtoms): EditorAtoms {
  while (editor.parent) editor = editor.parent
  return editor
}

export function createEditor(
  type: ConfigType,
  node: ReactiveNode<object>,
  parent?: EditorAtoms,
  resource?: Resource
): EditorAtoms {
  const value = node.value
  let editor: EditorAtoms
  const field = dispense(key => {
    const configField = getType(type).allFields[key]
    return configField ? createField(editor, key, configField) : undefined
  })
  function get(fieldToFind: Field): FieldAtoms | undefined {
    for (const [key, candidate] of Object.entries(getType(type).allFields)) {
      if (candidate === fieldToFind) return field(key)
    }
    return parent?.get(fieldToFind)
  }
  editor = {
    type,
    node,
    parent,
    resource: resource ?? parent?.resource,
    value,
    anchors: atom(get =>
      ConfigType.anchors(type, get(value) as Record<string, unknown>)
    ),
    sections: getType(type).sections.map(createSection),
    field,
    get
  }
  return editor
}

export interface SectionAtoms {
  section: ConfigSection
  view: Atom<
    | Exclude<ReturnType<typeof ConfigSection.view>, string>
    | ComponentType
    | undefined
  >
}

export function createSection(section: ConfigSection): SectionAtoms {
  return {
    section,
    view: atom(get => {
      const view = ConfigSection.view(section)
      return typeof view === 'string' ? get(viewAtom(view)) : view
    })
  }
}

export interface FieldAtoms {
  draft: EditorAtoms
  key: string
  field: Field
  value: WritableAtom<unknown, [unknown], void>
  options: Atom<FieldOptions<unknown>>
  error: Atom<string | undefined>
  view: Atom<
    Exclude<ReturnType<typeof Field.view>, string> | ComponentType | undefined
  >
}

export function createField(
  draft: EditorAtoms,
  key: string,
  field: Field
): FieldAtoms {
  const value = draft.node.field(key)
  const getter = atom(get => {
    return ((requestedField: Field) => {
      const info = draft.get(requestedField)
      assert(info, `Field not found: ${Field.label(requestedField)}`)
      return get(info.value)
    }) as FieldGetter
  })
  const options = atom(get => {
    const defaultOptions = Field.options(field)
    const tracker = optionTrackerOf(field)
    const update = tracker ? tracker(get(getter)) : undefined
    const trackedOptions = {...defaultOptions, ...update}
    const resolved = draft.node.readOnly
      ? {...trackedOptions, readOnly: true}
      : trackedOptions
    if (!draft.resource) return resolved
    const config = get(configAtom)
    const fieldName = getScope(config).nameOf(field)
    if (!fieldName) return resolved
    const policy = get(policyAtom)
    const fieldResource = {...draft.resource, field: fieldName}
    return {
      ...resolved,
      hidden: resolved.hidden || !policy.canRead(fieldResource),
      readOnly: resolved.readOnly || !policy.canUpdate(fieldResource)
    }
  })
  return {
    draft,
    key,
    field,
    value,
    options,
    error: atom((get): string | undefined => {
      const resolved = get(options) as FieldOptions<unknown>
      const current = get(value)
      if (resolved.validate) {
        const result = resolved.validate(current)
        if (typeof result === 'boolean')
          return result ? 'Field is invalid' : undefined
        return result
      }
      if (resolved.required) {
        if (current === undefined || current === null)
          return 'Field is required'
        if (typeof current === 'string' && current === '')
          return 'Field is required'
        if (Array.isArray(current) && current.length === 0)
          return 'Field is required'
      }
    }),
    view: atom(get => {
      const view = Field.view(field)
      return typeof view === 'string' ? get(viewAtom(view)) : view
    })
  }
}
