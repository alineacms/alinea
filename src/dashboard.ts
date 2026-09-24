/**
 * Compatibility exports for dashboard extensions written for Alinea 1.x.
 *
 * @deprecated Import hooks and view helpers from `alinea/cms` and UI
 * components from `alinea/components`.
 * @module
 */
import {Field as FieldFrame} from './components/Field.js'

/**
 * Renders the label, description and error around a form control.
 *
 * @deprecated Use `Field` from 'alinea/components', or `FieldChrome` from
 * 'alinea/cms' to take the label, help text and error from a field.
 */
export const Field = FieldFrame

/**
 * Renders the label, description and error around a form control. Help text
 * is no longer read from `{...options}`: pass it as `description`.
 *
 * @deprecated Use `Field` from 'alinea/components', or `FieldChrome` from
 * 'alinea/cms' to take the label, help text and error from a field.
 */
export const InputLabel = FieldFrame

export * from './dashboard/editor/UseField.js'
