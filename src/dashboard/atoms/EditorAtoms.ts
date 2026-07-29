import {Field, type EntryAnchorTarget, type FieldOptions} from '#/core/Field.js'
import {getType} from '#/core/Internal.js'
import type {Resource} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {Section as ConfigSection} from '#/core/Section.js'
import {FieldGetter, optionTrackerOf} from '#/core/Tracker.js'
import {Type as ConfigType} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import type {Atom, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import type {ComponentType} from 'react'
import {ReactiveNode} from './ReactiveNode.js'
import {policyAtom} from './UserAtoms.js'
import {dispense} from './AtomUtils.js'
import {configAtom, viewAtom} from './WorkspaceAtoms.js'

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

export interface TypeAtoms {
  type: ConfigType
  readonly contains: ReturnType<typeof getType>['contains']
  readonly label: ReturnType<typeof getType>['label']
  readonly orderChildrenBy: ReturnType<typeof getType>['orderChildrenBy']
  readonly defaultView: ReturnType<typeof ConfigType.defaultView>
  readonly icon: ReturnType<typeof getType>['icon']
  readonly sections: ReturnType<typeof getType>['sections']
}

export function createType(type: ConfigType): TypeAtoms {
  const settings = getType(type)
  return {
    type,
    contains: settings.contains,
    label: settings.label,
    orderChildrenBy: settings.orderChildrenBy,
    defaultView: ConfigType.defaultView(type),
    icon: settings.icon,
    sections: settings.sections
  }
}

export const typeAtoms = dispense((key: string) =>
  atom(get => {
    const config = get(configAtom)
    const type = config.schema[key]
    assert(type, `Type "${key}" not found in config`)
    return createType(type)
  })
)
