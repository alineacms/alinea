import {Field, Label, Reference, Type, Value} from '@alinea/core'
import {RecordValue} from '@alinea/core/value/RecordValue'

export type LinkType = 'entry' | 'image' | 'file' | 'external'

/** Optional settings to configure a link field */
export type LinkOptions<T> = {
  /** Add extra fields to each link */
  fields?: Type<T>
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** The type of links, this will configure the options of the link picker */
  type?: LinkType | Array<LinkType>
  /** Maximum amount of links that can be selected */
  max?: number
}

/** Internal representation of a link field */
export interface LinkField<T> extends Field.List<Reference & T> {
  label: Label
  options: LinkOptions<T>
}

/** Create a link field configuration */
export function createLink<T = {}>(
  label: Label,
  options: LinkOptions<T> = {}
): LinkField<T> {
  const extra = options.fields?.valueType
  return {
    type: Value.List({
      entry: new RecordValue({
        entry: Value.Scalar
      }).concat(extra),
      url: new RecordValue({
        url: Value.Scalar
      }).concat(extra)
    }),
    label,
    options
  }
}
