import type {Field} from '#/core/Field.js'
import type {RootData} from '#/core/Root.js'
import type {Section} from '#/core/Section.js'
import type {Type} from '#/core/Type.js'

/**
 * Props of the component a field points to with `view`, for example in
 * `Field.create({label, options, view: '@/fields/Range.view'})`.
 *
 * @example
 * export default function RangeView({field}: FieldViewProps<RangeField>) {
 *   const [value, setValue] = useField(field)
 * }
 */
export interface FieldViewProps<F extends Field = Field> {
  /** The field being rendered, pass it to the field hooks */
  field: F
}

/**
 * Props of the component passed to `Field.view(...)`, rendered between the
 * fields of a type.
 */
export interface SectionViewProps {
  /** The section that holds the view */
  section: Section
}

/**
 * Props of the component a type points to with `view`. It replaces the
 * default entry editor for entries of that type.
 */
export interface TypeViewProps {
  /** The type of the entry being shown */
  type: Type
}

/**
 * Props of the component a root points to with `view`. It replaces the
 * default root overview.
 */
export interface RootViewProps {
  /** The configuration of the root, including its `label` */
  root: RootData
}
