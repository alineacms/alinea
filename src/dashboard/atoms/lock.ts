import type {EditorUser, EditStatus, Heartbeat} from '#/core/EditLock.js'
import {createId} from '#/core/Id.js'
import {within} from '#/core/util/Async.js'
import {atom, type Getter} from 'jotai'
import {clientAtom} from './core.js'
import {dispense} from './utils.js'

/** One per tab, the same user in another tab is another session */
const session = createId()
const interval = 15_000

export type LockRequest = 'idle' | 'asking' | 'declined'

/** A status with the time it arrived, which its durations count from */
export interface LockStatus extends EditStatus {
  at: number
}

/** Who edits an entry, kept up to date while its editor is open */
export const entryLock = dispense((entryId: string, locale: string | null) => {
  async function send(
    get: Getter,
    beat: Partial<Heartbeat> = {}
  ): Promise<LockStatus> {
    const client = get(clientAtom)
    const status = await client.heartbeat({entryId, locale, session, ...beat})
    return {...status, at: Date.now()}
  }
  const visit = atom(0)
  const status = atom<LockStatus | undefined>(undefined)
  const request = atom<LockRequest>('idle')
  /** Who was given control while this session held the entry */
  const away = atom<EditorUser | undefined>(undefined)

  // A backend that cannot tell leaves the entry unlocked
  const ready = atom(async get => {
    get(visit)
    return within(send(get), 5000).catch(() => undefined)
  })

  const beat = atom(null, async (get, set, answer?: Heartbeat['answer']) => {
    const previous = get(status) ?? (await get(ready))
    const ask = get(request) === 'asking'
    const next = await send(get, {ask, answer})
    if (previous?.holds && next.holder && answer !== 'allow')
      set(away, next.holder.user)
    if (next.holds) set(request, 'idle')
    else if (next.declined) set(request, 'declined')
    set(status, next)
  })

  const ask = atom(null, (_get, set) => {
    set(request, 'asking')
    return set(beat)
  })

  const live = Object.assign(
    atom(
      get => get(status),
      (get, set) => {
        let active = true
        let timer: ReturnType<typeof setTimeout> | undefined
        function tick() {
          const visible = document.visibilityState === 'visible'
          const sent = visible ? set(beat).catch(() => {}) : Promise.resolve()
          void sent.then(() => {
            if (!active) return
            // Learn the outcome of a request as soon as it times out
            const pending = get(status)?.request
            const wait = pending?.mine ? pending.remaining + 250 : interval
            clearTimeout(timer)
            timer = setTimeout(tick, Math.min(wait, interval))
          })
        }
        function onVisible() {
          if (document.visibilityState === 'visible') tick()
        }
        timer = setTimeout(tick, interval)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          active = false
          clearTimeout(timer)
          document.removeEventListener('visibilitychange', onVisible)
          void send(get, {leave: true}).catch(() => {})
          set(status, undefined)
          set(request, 'idle')
          set(away, undefined)
          set(visit, visit => visit + 1)
        }
      }
    ),
    {onMount: (start: () => () => void) => start()}
  )

  return {ready, live, request, away, beat, ask}
})

export type EntryLockAtoms = ReturnType<typeof entryLock>
