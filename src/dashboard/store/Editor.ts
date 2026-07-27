import {Field, type EntryAnchorTarget, type FieldOptions} from '#/core/Field.js'
import {getType} from '#/core/Internal.js'
import type {Resource} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {Section} from '#/core/Section.js'
import {FieldGetter, optionTrackerOf} from '#/core/Tracker.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import type {Atom, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import type {Dashboard} from './Dashboard.js'
import {ReactiveNode} from './ReactiveNode.js'
import {dispense} from './StoreUtils.js'

export class DashboardEditor {
  value: Atom<object>
  anchors: Atom<Array<EntryAnchorTarget>>
  sections: Array<DashboardSection>

  constructor(
    public dashboard: Dashboard,
    public type: Type,
    public node: ReactiveNode<object>,
    public parent?: DashboardEditor,
    public resource?: Resource
  ) {
    this.resource ??= parent?.resource
    this.value = node.value
    this.anchors = atom(get =>
      Type.anchors(this.type, get(this.value) as Record<string, unknown>)
    )
    this.sections = getType(this.type).sections.map(
      section => new DashboardSection(this.dashboard, section)
    )
  }

  field = dispense(key => {
    const fields = getType(this.type).allFields
    const field = fields[key]
    if (!field) return undefined
    return new DashboardField(this, key, field)
  })

  get(field: Field): DashboardField | undefined {
    const fields = getType(this.type).allFields
    for (const [key, candidate] of Object.entries(fields)) {
      if (candidate === field) return this.field(key)
    }
    return this.parent?.get(field)
  }
}

export class DashboardSection {
  constructor(
    public dashboard: Dashboard,
    public section: Section
  ) {}

  view = atom(get => {
    const view = Section.view(this.section)
    if (typeof view === 'string') return get(this.dashboard.view(view))
    return view
  })
}

export class DashboardField {
  value: WritableAtom<unknown, [unknown], void>

  constructor(
    public draft: DashboardEditor,
    public key: string,
    public field: Field
  ) {
    this.value = this.draft.node.field(key)
  }

  #getter = atom(get => {
    return ((field: Field) => {
      const info = this.draft.get(field)
      assert(info, `Field not found: ${Field.label(field)}`)
      return get(info.value)
    }) as FieldGetter
  })

  options = atom(get => {
    const defaultOptions = Field.options(this.field)
    const tracker = optionTrackerOf(this.field)
    const update = tracker ? tracker(get(this.#getter)) : undefined
    const trackedOptions = {...defaultOptions, ...update}
    const options = this.draft.node.readOnly
      ? {...trackedOptions, readOnly: true}
      : trackedOptions
    const resource = this.draft.resource
    if (!resource) return options
    const config = get(this.draft.dashboard.config)
    const fieldName = getScope(config).nameOf(this.field)
    if (!fieldName) return options
    const policy = get(this.draft.dashboard.policy)
    const fieldResource = {...resource, field: fieldName}
    return {
      ...options,
      hidden: options.hidden || !policy.canRead(fieldResource),
      readOnly: options.readOnly || !policy.canUpdate(fieldResource)
    }
  })

  error = atom((get): string | undefined => {
    const options = get(this.options) as FieldOptions<unknown>
    const value = get(this.value)
    if (options.validate) {
      const result = options.validate(value)
      if (typeof result === 'boolean')
        return result ? 'Field is invalid' : undefined
      return result
    }
    if (options.required) {
      if (value === undefined || value === null) return 'Field is required'
      if (typeof value === 'string' && value === '') return 'Field is required'
      if (Array.isArray(value) && value.length === 0) return 'Field is required'
    }
    return undefined
  })

  view = atom(get => {
    const view = Field.view(this.field)
    if (typeof view === 'string') return get(this.draft.dashboard.view(view))
    return view
  })
}

export class DashboardType {
  constructor(
    public dashboard: Dashboard,
    public type: Type
  ) {}

  get contains() {
    return getType(this.type).contains
  }

  get label() {
    return getType(this.type).label
  }

  get orderChildrenBy() {
    return getType(this.type).orderChildrenBy
  }

  get defaultView() {
    return Type.defaultView(this.type)
  }

  get icon() {
    return getType(this.type).icon
  }

  get sections() {
    return getType(this.type).sections
  }
}
