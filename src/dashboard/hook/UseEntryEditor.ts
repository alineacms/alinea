import type {EntryStatus} from 'alinea/core/Entry'
import {atom, useAtomValue} from 'jotai'
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

interface EntryEditorSourceVersion extends EntryEditorVersion {
  status: EntryStatus
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
  const activeVersion = useAtomValue(entry?.activeVersion ?? nullVersionAtom)
  if (!entry || !activeVersion) return undefined
  const version = strictObject('entry editor activeVersion', {
    data: strictObject('entry editor activeVersion.data', {
      path: activeVersion.path,
      status: activeVersion.status
    }),
    id: activeVersion.id,
    locale: activeVersion.locale,
    path: activeVersion.path,
    title: activeVersion.title,
    type: activeVersion.type
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

const nullVersionAtom = atom<EntryEditorSourceVersion | null>(null)

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
