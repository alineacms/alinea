import type {
  FieldLocalizeContext,
  FieldOptions,
  WithoutLabel
} from '#/core/Field.js'
import {
  type EntryReferenceLinkType,
  type EntryReferenceTarget,
  referenceFieldPath
} from '#/core/db/EntryReference.js'
import {ListFieldBase} from '#/core/field/ListField.js'
import {UnionField} from '#/core/field/UnionField.js'
import type {
  EdgeEntries,
  EdgeEntry,
  GraphQuery,
  IncludeGuard,
  PickModifiers,
  QueryModifiers,
  SelectionGuard,
  TypeGuard
} from '#/core/Graph.js'
import type {Picker} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import type {Schema} from '#/core/Schema.js'
import {ListRow} from '#/core/ListRow.js'
import {entries, fromEntries} from '#/core/util/Objects.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {unresolvedEntryMarker} from '#/picker/entry/EntryPicker.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import type {ReactNode} from 'react'

/** Optional settings to configure a link field */
export interface LinkFieldOptions<Value> extends FieldOptions<Value> {
  /**
   * Allow the same entry to be linked more than once.
   * Defaults to false for entry fields and true for generic link fields.
   */
  allowDuplicates?: boolean
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  max?: number
}

export interface LinkOptions<Value> extends LinkFieldOptions<Value> {
  /** @internal */
  isEntryField?: boolean
  pickers: Record<string, Picker<any, any>>
}

export class LinkField<
  StoredValue extends Reference,
  QueryValue
> extends UnionField<StoredValue, QueryValue, LinkOptions<StoredValue>> {
  first<
    Selection extends SelectionGuard = undefined,
    const Type extends TypeGuard = undefined,
    Include extends IncludeGuard = undefined
  >(
    query: GraphQuery<Selection, Type, Include>
  ): GraphQuery<NoInfer<Selection>, NoInfer<Type>, NoInfer<Include>> &
    EdgeEntry & {first: true} {
    return {edge: 'entrySingle', first: true, field: this, ...query}
  }
}

export function createLink<StoredValue extends Reference, QueryValue>(
  label: string,
  options: WithoutLabel<LinkOptions<StoredValue>>
): LinkField<StoredValue, QueryValue> {
  const pickers = entries(options.pickers)
  const schema: Schema = fromEntries(
    pickers
      .filter(([type, picker]) => picker.fields)
      .map(([type, picker]) => [type, picker.fields])
  )
  return new LinkField(schema, {
    options: {label, initialValue: null!, ...options},
    async queryValue(value, loader) {
      const type = value[Reference.type]
      const picker = options.pickers[type]
      if (!picker) return value as unknown as QueryValue
      if (picker.postProcess) await picker.postProcess(value, loader)
      return value as unknown as QueryValue
    },
    references(value, context) {
      const entryId = entryIdOf(value)
      if (!entryId) return []
      return [
        {
          targetId: entryId,
          fieldPath: referenceFieldPath(context.path),
          fieldLabel: context.label,
          linkId: value[Reference.id],
          linkType: entryLinkType(value[Reference.type])
        }
      ]
    },
    localizeLinks(value, context) {
      return localizeEntryLink(value, context)
    },
    view: viewKeys.SingleLinkInput
  })
}

/** Internal representation of a link field */
export class LinksField<
  StoredValue extends ListRow,
  QueryValue
> extends ListFieldBase<
  StoredValue,
  QueryValue,
  LinkOptions<Array<StoredValue>>
> {
  find<
    Selection extends SelectionGuard = undefined,
    Type extends TypeGuard = undefined,
    Include extends IncludeGuard = undefined,
    Modifiers extends QueryModifiers = {}
  >(
    query: GraphQuery<Selection, Type, Include> & Modifiers
  ): GraphQuery<NoInfer<Selection>, NoInfer<Type>, NoInfer<Include>> &
    EdgeEntries &
    PickModifiers<NoInfer<Modifiers>> {
    return {edge: 'entryMultiple', field: this, ...query}
  }

  first<
    Selection extends SelectionGuard = undefined,
    const Type extends TypeGuard = undefined,
    Include extends IncludeGuard = undefined
  >(
    query?: GraphQuery<Selection, Type, Include>
  ): GraphQuery<NoInfer<Selection>, NoInfer<Type>, NoInfer<Include>> &
    EdgeEntries & {first: true} {
    return {edge: 'entryMultiple', first: true, field: this, ...query}
  }

  count<
    Selection extends SelectionGuard = undefined,
    const Type extends TypeGuard = undefined,
    Include extends IncludeGuard = undefined
  >(
    query?: GraphQuery<Selection, Type, Include>
  ): GraphQuery<NoInfer<Selection>, NoInfer<Type>, NoInfer<Include>> &
    EdgeEntries & {count: true} {
    return {edge: 'entryMultiple', count: true, field: this, ...query}
  }
}

/** Create a link field configuration */
export function createLinks<StoredValue extends ListRow, QueryValue>(
  label: string,
  options: WithoutLabel<LinkOptions<Array<StoredValue>>>
): LinksField<StoredValue, QueryValue> {
  const pickers = entries(options.pickers)
  const schema: Schema = fromEntries(
    pickers
      .filter(([type, picker]) => picker.fields)
      .map(([type, picker]) => [type, picker.fields])
  )
  return new LinksField(schema, {
    options: {label, ...options},
    async queryValue(rows, loader) {
      const tasks = []
      for (const row of rows) {
        const type = row[ListRow.type]
        const picker = options.pickers[type]
        if (!picker) continue
        if (picker.postProcess) tasks.push(picker.postProcess(row, loader))
      }
      await Promise.all(tasks)
      for (let index = rows.length - 1; index >= 0; index--) {
        const row = rows[index] as StoredValue & {
          [unresolvedEntryMarker]?: true
        }
        if (row[unresolvedEntryMarker]) rows.splice(index, 1)
      }
      return rows as unknown as Array<QueryValue>
    },
    references(rows, context) {
      if (!Array.isArray(rows)) return []
      const result: Array<EntryReferenceTarget> = []
      for (const row of rows) {
        const entryId = entryIdOf(row)
        if (!entryId) continue
        const rowId = row[ListRow.id]
        result.push({
          targetId: entryId,
          fieldPath: referenceFieldPath(
            rowId ? [...context.path, rowId] : context.path
          ),
          fieldLabel: context.label,
          linkId: row[Reference.id],
          linkType: entryLinkType(row[Reference.type])
        })
      }
      return result
    },
    localizeLinks(rows, context) {
      if (!Array.isArray(rows)) return rows
      let next = rows
      rows.forEach((row, index) => {
        const localized = localizeEntryLink(row, context)
        if (localized === row) return
        if (next === rows) next = [...rows]
        next[index] = localized
      })
      return next
    },
    view: viewKeys.MultipleLinksInput
  })
}

function entryIdOf(value: Reference | undefined | null): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const entry = (value as {_entry?: unknown})._entry
  return typeof entry === 'string' ? entry : undefined
}

function localizeEntryLink<Value extends Reference>(
  value: Value,
  context: FieldLocalizeContext
): Value {
  if (!value || value[Reference.type] !== 'entry') return value
  const entryId = entryIdOf(value)
  if (!entryId || !context.entryIds.has(entryId)) return value
  if (
    (value as Partial<EntryReference>)[EntryReference.locale] === context.locale
  )
    return value
  return {...value, [EntryReference.locale]: context.locale}
}

function entryLinkType(type: string): EntryReferenceLinkType | undefined {
  return type === 'entry' || type === 'image' || type === 'file'
    ? type
    : undefined
}
