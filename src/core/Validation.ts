import type {Config} from './Config.js'
import {Field, type FieldOptions} from './Field.js'
import type {Policy, Resource} from './Role.js'
import {getScope} from './Scope.js'
import {type FieldGetter, optionTrackerOf} from './Tracker.js'
import {Type} from './Type.js'
import {entries, isRecord} from './util/Objects.js'

/** Keys into the entry data, list rows and rich text blocks by index */
export type FieldPath = Array<string | number>

export interface FieldValidationError {
  path: FieldPath
  /** Labels of the fields (and row types) along the path */
  labels: Array<string>
  message: string
}

/** Adjusts the options of a field before it is validated, eg. for policies */
export interface FieldOptionsResolver {
  (field: Field, options: FieldOptions<unknown>): FieldOptions<unknown>
}

export interface ValidationScope {
  type: Type
  value: Record<string, unknown>
}

export interface FieldValidationContext {
  path: FieldPath
  labels: Array<string>
  /** The records enclosing the field, outermost first, to resolve trackers */
  scopes: Array<ValidationScope>
  locale: string | null
  fieldOptions?: FieldOptionsResolver
}

export interface ValidateEntryOptions {
  locale?: string | null
  fieldOptions?: FieldOptionsResolver
}

/**
 * The error message for a single field value, or undefined if it is valid.
 * Nested fields (list rows, object fields, blocks) are not checked here.
 */
export function fieldError(
  field: Field,
  options: FieldOptions<unknown>,
  value: unknown
): string | undefined {
  const {min, max} = options as {min?: unknown; max?: unknown}
  if (Array.isArray(value)) {
    if (typeof min === 'number' && value.length < min)
      return `Add at least ${min} ${min === 1 ? 'item' : 'items'}`
    if (typeof max === 'number' && value.length > max)
      return `Add at most ${max} ${max === 1 ? 'item' : 'items'}`
  }
  if (options.validate) {
    let result: ReturnType<NonNullable<typeof options.validate>>
    try {
      result = options.validate(value)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
    // Returning true means valid, false shows a generic message
    if (result === false) return 'Field is invalid'
    if (typeof result === 'string') return result
  }
  if (options.required && Field.isEmpty(field, value))
    return 'Field is required'
  return undefined
}

/** A getter for option trackers, reading from the innermost scope first */
export function scopeGetter(scopes: Array<ValidationScope>): FieldGetter {
  return ((field: Field) => {
    const ref = Field.ref(field)
    for (let i = scopes.length - 1; i >= 0; i--) {
      const {type, value} = scopes[i]
      for (const [key, candidate] of entries(Type.fields(type)))
        if (Field.ref(candidate) === ref) return value[key]
    }
    return undefined
  }) as FieldGetter
}

/** Field options with tracked options applied */
export function trackedFieldOptions(
  field: Field,
  getter: FieldGetter
): FieldOptions<unknown> {
  const options = Field.options(field) as FieldOptions<unknown>
  const tracker = optionTrackerOf(field)
  if (!tracker) return options
  return {...options, ...tracker(getter)}
}

/**
 * Hides fields the policy does not allow reading and makes fields read-only
 * which the policy does not allow updating, like the dashboard shows them.
 */
export function policyFieldOptions(
  config: Config,
  policy: Policy,
  resource: Resource
): FieldOptionsResolver {
  const scope = getScope(config)
  return (field, options) => {
    const name = scope.nameOf(field)
    if (!name) return options
    const fieldResource = {...resource, field: name}
    return {
      ...options,
      hidden: options.hidden || !policy.canRead(fieldResource),
      readOnly: options.readOnly || !policy.canUpdate(fieldResource)
    }
  }
}

/**
 * Validate the fields of a type. Hidden and read-only fields (and anything
 * nested in them) are skipped: editors cannot see or change them.
 */
export function validateType(
  type: Type,
  value: unknown,
  context: FieldValidationContext
): Array<FieldValidationError> {
  const record = isRecord(value) ? value : {}
  const scopes = [...context.scopes, {type, value: record}]
  const getter = scopeGetter(scopes)
  const result = Array<FieldValidationError>()
  for (const [key, field] of entries(Type.fields(type))) {
    const tracked = trackedFieldOptions(field, getter)
    const options = context.fieldOptions?.(field, tracked) ?? tracked
    if (options.hidden || options.readOnly) continue
    const path = [...context.path, key]
    const labels = [...context.labels, options.label]
    const fieldValue = record[key]
    const message = fieldError(field, options, fieldValue)
    if (message) result.push({path, labels, message})
    result.push(
      ...Field.nestedErrors(field, fieldValue, {
        ...context,
        path,
        labels,
        scopes
      })
    )
  }
  return result
}

/** Validate entry data: required, min, max and validate options */
export function validateEntry(
  type: Type,
  data: unknown,
  options: ValidateEntryOptions = {}
): Array<FieldValidationError> {
  return validateType(type, data, {
    path: [],
    labels: [],
    scopes: [],
    locale: options.locale ?? null,
    fieldOptions: options.fieldOptions
  })
}

export function formatFieldPath(path: FieldPath): string {
  let result = ''
  for (const segment of path) {
    if (typeof segment === 'number') result += `[${segment}]`
    else result += result ? `.${segment}` : segment
  }
  return result
}

export function formatValidationErrors(
  errors: ReadonlyArray<FieldValidationError>
): string {
  return errors
    .map(
      error =>
        `- ${formatFieldPath(error.path)} (${error.labels.join(' › ')}): ${error.message}`
    )
    .join('\n')
}
