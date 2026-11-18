import {createRecord, parseRecord} from '#/core/EntryRecord.js'
import {contentRoot} from '#/core/graft/Roots.js'
import {Schema} from '#/core/Schema.js'
import type {Json} from '@alinea/graft'
import {useAtomValueRaw, useAtomValueRawSync, useStore} from 'jotai'
import {useEffect} from 'react'
import {clientAtom, configAtom} from '../atoms/core.js'
import type {EntryLocaleAtoms} from '../atoms/entry.js'
import {liveEditingAtom, sessionsAvailableAtom} from '../atoms/live.js'
import {LiveSession} from './LiveSession.js'

/**
 * Joins the session of the entry being edited while this editor chose to
 * edit together and the project has sessions, and leaves it when the form
 * changes or closes.
 */
export function useLiveSession(locale: EntryLocaleAtoms): void {
  const store = useStore()
  const enabled = useAtomValueRaw(liveEditingAtom)
  const available = useAtomValueRawSync(sessionsAvailableAtom)
  const node = useAtomValueRaw(locale.currentlyEditing)
  const client = useAtomValueRaw(clientAtom)
  const config = useAtomValueRaw(configAtom)
  useEffect(() => {
    const live = client.live
    if (!enabled || !available || !node || node.readOnly || !live) return
    const entry = store
      .get(locale.entry.data)
      .entries.find(
        candidate =>
          candidate.locale === locale.requestedLocale && candidate.active
      )
    if (!entry) return
    const session = new LiveSession({
      ...live,
      branch: 'refs/heads/main',
      path: `${contentRoot}/${entry.filePath}`,
      shape: Schema.shape(config.schema),
      store,
      value: node.value as never,
      toRecord: data => createRecord({...entry, data}, entry.status) as Json,
      fromRecord: (record, current) => ({
        ...parseRecord(record as never).data,
        path: current.path
      })
    })
    const started = session.start().catch(error => {
      console.warn(`Alinea could not join the live session: ${error}`)
    })
    return () => {
      void started.then(() => session.stop())
    }
  }, [enabled, available, node, client, config, store, locale])
}
