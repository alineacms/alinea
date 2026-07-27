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
import type {Dashboard} from './Dashboard.js'
import {ReactiveNode} from './ReactiveNode.js'
import {dispense} from './StoreUtils.js'

export interface Editor {
  dashboard: Dashboard
  type: ConfigType
  node: ReactiveNode<object>
  parent?: Editor
  resource?: Resource
  value: Atom<object>
  anchors: Atom<Array<EntryAnchorTarget>>
  sections: Array<Section>
  field(key: string): FieldState | undefined
  get(field: Field): FieldState | undefined
}

export function createEditor(
  dashboard: Dashboard,
  type: ConfigType,
  node: ReactiveNode<object>,
  parent?: Editor,
  resource?: Resource
): Editor {
  const value = node.value
  const editor: Editor = {
    dashboard,
    type,
    node,
    parent,
    resource: resource ?? parent?.resource,
    value,
    anchors: atom(get =>
      ConfigType.anchors(type, get(value) as Record<string, unknown>)
    ),
    sections: [],
    field: () => undefined,
    get: () => undefined
  }
  editor.sections = getType(type).sections.map(section =>
    createSection(dashboard, section)
  )
  editor.field = dispense(key => {
    const field = getType(type).allFields[key]
    return field ? createField(editor, key, field) : undefined
  })
  editor.get = field => {
    for (const [key, candidate] of Object.entries(getType(type).allFields)) {
      if (candidate === field) return editor.field(key)
    }
    return parent?.get(field)
  }
  return editor
}

export interface Section {
  dashboard: Dashboard
  section: ConfigSection
  view: Atom<
    | Exclude<ReturnType<typeof ConfigSection.view>, string>
    | ComponentType
    | undefined
  >
}

export function createSection(
  dashboard: Dashboard,
  section: ConfigSection
): Section {
  return {
    dashboard,
    section,
    view: atom(get => {
      const view = ConfigSection.view(section)
      return typeof view === 'string' ? get(dashboard.view(view)) : view
    })
  }
}

export interface FieldState {
  draft: Editor
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
  draft: Editor,
  key: string,
  field: Field
): FieldState {
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
    const config = get(draft.dashboard.config)
    const fieldName = getScope(config).nameOf(field)
    if (!fieldName) return resolved
    const policy = get(draft.dashboard.policy)
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
      return typeof view === 'string' ? get(draft.dashboard.view(view)) : view
    })
  }
}

export interface TypeState {
  dashboard: Dashboard
  type: ConfigType
  readonly contains: ReturnType<typeof getType>['contains']
  readonly label: ReturnType<typeof getType>['label']
  readonly orderChildrenBy: ReturnType<typeof getType>['orderChildrenBy']
  readonly defaultView: ReturnType<typeof ConfigType.defaultView>
  readonly icon: ReturnType<typeof getType>['icon']
  readonly sections: ReturnType<typeof getType>['sections']
}

export function createType(
  dashboard: Dashboard,
  type: ConfigType
): TypeState {
  const settings = getType(type)
  return {
    dashboard,
    type,
    contains: settings.contains,
    label: settings.label,
    orderChildrenBy: settings.orderChildrenBy,
    defaultView: ConfigType.defaultView(type),
    icon: settings.icon,
    sections: settings.sections
  }
}
