import type {Entry} from '#/core/Entry.js'
import {Field} from '#/core/Field.js'
import {isRecord} from '#/core/util/Objects.js'
import {atom, useAtomValueRaw} from 'jotai'
import {useContext, useMemo} from 'react'
import {
  type EntryContextValue,
  entryContext,
  useFieldInfo
} from '../contexts.js'
import {useLocale} from '../hooks.js'

const noLanguages: ReadonlyArray<string> = []

/** The records of an entry with an id, eg. list rows and blocks, by id */
const byIdCache = new WeakMap<object, Map<string, Record<string, unknown>>>()

function recordsById(data: object): Map<string, Record<string, unknown>> {
  const cached = byIdCache.get(data)
  if (cached) return cached
  const result = new Map<string, Record<string, unknown>>()
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!isRecord(value)) return
    if (typeof value._id === 'string') result.set(value._id, value)
    Object.values(value).forEach(visit)
  }
  visit(data)
  byIdCache.set(data, result)
  return result
}

const statusOrder = ['published', 'draft', 'archived']

/** One version of the entry for each other language, published first */
function otherLanguages(versions: Array<Entry>, locale: string): Array<Entry> {
  const byLocale = new Map<string, Entry>()
  const sorted = [...versions].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
  )
  for (const version of sorted)
    if (
      version.locale &&
      version.locale !== locale &&
      !byLocale.has(version.locale)
    )
      byLocale.set(version.locale, version)
  return [...byLocale.values()]
}

const noEntry = atom<{entries: Array<Entry>} | null>(null)
const translated = atom(false)

/**
 * The record with this id, eg. a list row, in the other languages of the
 * entry being edited, to compare what each language filled in
 */
export function useOtherLanguages(
  id: string | null
): Array<{locale: string; record: Record<string, unknown>}> {
  const context = useContext(entryContext)
  const locale = useLocale()
  const data = useAtomValueRaw(context?.entry.data ?? noEntry)
  const untranslated = useAtomValueRaw(
    context?.localeData.untranslated ?? translated
  )
  return useMemo(() => {
    if (!data || !locale || !id || untranslated) return []
    return otherLanguages(data.entries, locale).flatMap(version => {
      const record = recordsById(version.data as object).get(id)
      return record ? [{locale: version.locale!, record}] : []
    })
  }, [data, id, locale, untranslated])
}

/**
 * The other languages of the entry that filled in a field the language
 * being edited left empty. Fields of the entry are found by key, fields of
 * list rows and blocks by the id of their row. Shared fields are the same
 * in every language and are not compared.
 */
export function useMissingLanguages(
  context: EntryContextValue,
  field: Field,
  shared: boolean
): ReadonlyArray<string> {
  const locale = useLocale()
  const info = useFieldInfo(field)
  const value = useAtomValueRaw(info.value)
  const container = useAtomValueRaw(info.editor.node.value) as Record<
    string,
    unknown
  >
  const data = useAtomValueRaw(context.entry.data)
  const untranslated = useAtomValueRaw(context.localeData.untranslated)
  return useMemo(() => {
    if (!locale || shared || untranslated) return noLanguages
    if (!Field.isEmpty(field, value)) return noLanguages
    const nested = Boolean(info.editor.parent)
    const rowId = typeof container?._id === 'string' ? container._id : null
    // Fields of an object have no row id to find them by
    if (nested && !rowId) return noLanguages
    const result = Array<string>()
    for (const version of otherLanguages(data.entries, locale)) {
      const theirs = nested
        ? recordsById(version.data as object).get(rowId!)
        : (version.data as Record<string, unknown>)
      if (theirs && !Field.isEmpty(field, theirs[info.key]))
        result.push(version.locale!)
    }
    return result.length > 0 ? result : noLanguages
  }, [container, data, field, info, locale, shared, untranslated, value])
}
