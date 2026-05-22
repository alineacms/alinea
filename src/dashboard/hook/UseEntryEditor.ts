import type {EntryStatus} from 'alinea/core/Entry'
import {useEntry} from '../store.js'

export interface EntryEditorVersionData {
  path: string
  status: EntryStatus
}

export interface EntryEditorVersion {
  data: EntryEditorVersionData
  id: string
  locale: string | null
  path: string
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
 * @deprecated Compatibility hook for legacy dashboard extensions. Only a small
 * subset of the v1 EntryEditor shape is supported.
 */
export function useEntryEditor(): EntryEditor | undefined {
  const entry = useEntry()
  if (!entry) return undefined
  const version = strictObject('entry editor activeVersion', {
    data: strictObject('entry editor activeVersion.data', {
      path: entry.path,
      status: entry.status
    }),
    id: entry.id,
    locale: entry.locale,
    path: entry.path,
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
      throw new Error(`${label}.${property} is not supported in dashboard v2`)
    }
  })
}
