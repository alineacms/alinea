/**
 * Build custom CMS UI: field views, section views and type or root views
 * that the dashboard renders. Everything here needs the dashboard context.
 *
 * Generic UI building blocks (buttons, inputs, dialogs, ...) live in
 * `alinea/components`.
 *
 * @module
 */

// Field hooks
export {
  useField,
  useFieldError,
  useFieldKey,
  useFieldOptions,
  useFieldSetter,
  useFieldValue,
  useSiblingFieldValue
} from './dashboard/hooks.js'

// Entry and dashboard context
export {
  type DashboardLocation,
  useEntry,
  useGraph,
  useLocale,
  useNavigate,
  usePolicy,
  usePreviewMetadata,
  useUser
} from './dashboard/hooks.js'
export type {Policy} from './core/Role.js'
export type {PreviewMetadata} from './core/Preview.js'
export type {User} from './core/User.js'

// Rendering fields
export {
  EditField,
  type EditFieldProps,
  EditFields,
  type EditFieldsProps
} from './dashboard/app/EntryFields.js'
export {
  FieldChrome,
  type FieldChromeProps
} from './dashboard/cms/FieldChrome.js'

// View props
export type {
  FieldViewProps,
  RootViewProps,
  SectionViewProps,
  TypeViewProps
} from './dashboard/cms/ViewProps.js'
