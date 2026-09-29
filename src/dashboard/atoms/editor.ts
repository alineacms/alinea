import {Field, type EntryAnchorTarget, type FieldOptions} from '#/core/Field.js'
import type {Resource} from '#/core/Role.js'
import type {Policy} from '#/core/Role.js'
import {Section} from '#/core/Section.js'
import type {FieldGetter} from '#/core/Tracker.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {
  fieldError,
  policyFieldOptions,
  trackedFieldOptions
} from '#/core/Validation.js'
import type {Atom, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import type {ComponentType, ReactNode} from 'react'
import {configAtom, viewsAtom} from './core.js'
import {dispense} from './utils.js'

export interface ResolvedEditorImage {
  src: string
  alt: string
}

const emptyResolvedImages = new Map<string, ResolvedEditorImage>()

export interface EditorNode {
  readOnly: boolean
  nodes: WritableAtom<unknown, [unknown], void>
  value: Atom<object>
  field(key: string): WritableAtom<unknown, [unknown], void>
}

export interface EditorModel {
  anchors: Atom<Array<EntryAnchorTarget>>
  node: EditorNode
  parent?: EditorModel
  resolvedImages: ReadonlyMap<string, ResolvedEditorImage>
  sections: Array<EditorSection>
  type: Type
  field(key: string): EditorField | undefined
  get(field: Field): EditorField | undefined
}

export interface EditorSection {
  section: Section
  view: Atom<
    | ComponentType
    | ComponentType<{section: Section}>
    | ((props: {section: Section}) => ReactNode)
    | undefined
  >
}

export interface EditorField {
  key: string
  value: WritableAtom<unknown, [unknown], void>
  options: Atom<FieldOptions<unknown>>
  error: Atom<string | undefined>
  view: Atom<
    | ComponentType
    | ComponentType<{field: Field}>
    | ((props: {field: Field}) => ReactNode)
    | undefined
  >
}

export class EntryEditor implements EditorModel {
  anchors: Atom<Array<EntryAnchorTarget>>
  readonly readOnly: boolean
  value: Atom<object>
  sections: Array<EntryEditorSection>

  constructor(
    public type: Type,
    public node: EditorNode,
    public parent?: EntryEditor,
    public resource?: Resource,
    public policy?: Policy,
    public resolvedImages: ReadonlyMap<
      string,
      ResolvedEditorImage
    > = parent?.resolvedImages ?? emptyResolvedImages,
    readOnly?: boolean
  ) {
    this.readOnly = Boolean(readOnly || node.readOnly || parent?.readOnly)
    this.resource ??= parent?.resource
    this.policy ??= parent?.policy
    this.value = node.value
    this.anchors = atom(get =>
      Type.anchors(type, get(node.value) as Record<string, unknown>)
    )
    this.sections = Type.sections(type).map(
      section => new EntryEditorSection(section)
    )
  }

  field = dispense((key: string) => {
    const field = Type.field(this.type, key)
    if (!field) return undefined
    return new EntryEditorField(this, key, field)
  })

  get(field: Field): EntryEditorField | undefined {
    for (const [key, candidate] of Object.entries(Type.fields(this.type))) {
      if (candidate === field) return this.field(key)
    }
    return this.parent?.get(field)
  }
}

export function rootEditor(editor: EditorModel): EditorModel {
  while (editor.parent) editor = editor.parent
  return editor
}

export class EntryEditorSection implements EditorSection {
  constructor(public section: Section) {}

  view = atom(get => {
    const view = Section.view(this.section)
    if (typeof view === 'string')
      return get(viewsAtom)[view] as
        | ComponentType<{section: Section}>
        | undefined
    return view
  })
}

class EntryEditorField implements EditorField {
  value: WritableAtom<unknown, [unknown], void>

  constructor(
    public editor: EntryEditor,
    public key: string,
    public field: Field
  ) {
    this.value = editor.node.field(key)
  }

  #getter = atom(get => {
    return ((field: Field) => {
      const info = this.editor.get(field)
      assert(info, `Field not found: ${Field.label(field)}`)
      return get(info.value)
    }) as FieldGetter
  })

  options = atom((get): FieldOptions<unknown> => {
    const tracked = trackedFieldOptions(this.field, get(this.#getter))
    const options = this.editor.readOnly
      ? {...tracked, readOnly: true}
      : tracked
    const {resource, policy} = this.editor
    if (!resource || !policy) return options
    return policyFieldOptions(
      get(configAtom),
      policy,
      resource
    )(this.field, options)
  })

  error = atom((get): string | undefined => {
    return fieldError(this.field, get(this.options), get(this.value))
  })

  view = atom(get => {
    const view = Field.view(this.field)
    if (typeof view === 'string')
      return get(viewsAtom)[view] as ComponentType<{field: Field}> | undefined
    return view as ComponentType<{field: Field}>
  })
}
