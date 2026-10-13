import type {EntryStatus} from '#/core/Entry.js'
import {useEntry} from '../hooks.js'

export interface EntryEditorVersionData {
  path: string
}

export interface EntryEditorVersion {
  data: EntryEditorVersionData
  id: string
  locale: string | null
  path: string
  status: EntryStatus
  title: string
  type: string
}

export interface EntryEditorData {
  versions: readonly [EntryEditorVersion]
}

export interface EntryEditor {
  activeVersion: EntryEditorVersion
  entryData: EntryEditorData
  entryId: string
}

/**
 * Returns the consumer-facing entry editor shape. Only the fields declared by
 * EntryEditor are supported; dashboard atoms remain an internal detail.
 *
 * @deprecated Use `useEntry` from 'alinea/cms': it returns the entry being
 * edited with its `id`, `locale`, `path`, `title`, `type` and `status`.
 */
export function useEntryEditor(): EntryEditor | undefined {
  const entry = useEntry()
  if (!entry) return undefined
  const version = strictObject('entry editor activeVersion', {
    // In 1.x data held the field values: only path is kept here, reading
    // another field (a custom `status` too) throws instead of guessing
    data: strictObject('entry editor activeVersion.data', {
      path: entry.path
    }),
    id: entry.id,
    locale: entry.locale,
    path: entry.path,
    status: entry.status,
    title: entry.title,
    type: entry.type
  })
  return strictObject('entry editor', {
    activeVersion: version,
    entryData: strictObject('entry editor entryData', {
      versions: strictObject('entry editor entryData.versions', {
        0: version
      }) as unknown as readonly [EntryEditorVersion]
    }),
    entryId: entry.id
  })
}

function strictObject<Value extends object>(
  label: string,
  value: Value
): Value {
  return new Proxy(value, {
    get(target, property, receiver) {
      if (typeof property === 'symbol')
        return Reflect.get(target, property, receiver)
      if (property in target) return Reflect.get(target, property, receiver)
      throw new Error(
        `${label}.${property} is not supported in dashboard v2, read the entry with useEntry() from alinea/cms`
      )
    }
  })
}
