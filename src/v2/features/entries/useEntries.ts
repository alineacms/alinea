import {Entry} from 'alinea/core/Entry'
import type {LocalDB} from 'alinea/core/db/LocalDB'
import {useApp} from '../../hooks'
import {useMemo} from 'react'

export interface DashboardEntry {
  id: string
  title: string
  type: string
  status: string
  parentId: string | null
  locale: string | null
}

type PromiseStatus = 'pending' | 'resolved' | 'rejected'
type TrackedPromise<T> = Promise<T> & {
  status?: PromiseStatus
  value?: T
  reason?: unknown
}

const entriesPromises = new Map<string, Promise<Array<DashboardEntry>>>()

function trackPromise<T>(input: Promise<T>): TrackedPromise<T> {
  const tracked = input as TrackedPromise<T>
  if (tracked.status) return tracked
  tracked.status = 'pending'
  tracked.then(
    value => {
      tracked.status = 'resolved'
      tracked.value = value
    },
    reason => {
      tracked.status = 'rejected'
      tracked.reason = reason
    }
  )
  return tracked
}

function readPromise<T>(promise: Promise<T>): T {
  const tracked = trackPromise(promise)
  if (tracked.status === 'resolved') return tracked.value as T
  if (tracked.status === 'rejected') throw tracked.reason
  throw tracked
}

function entriesPromise(
  db: LocalDB,
  workspace: string,
  root: string
): Promise<Array<DashboardEntry>> {
  const key = `${workspace}/${root}`
  const existing = entriesPromises.get(key)
  if (existing) return existing
  const promise = db
    .find({
      select: {
        id: Entry.id,
        title: Entry.title,
        type: Entry.type,
        status: Entry.status,
        parentId: Entry.parentId,
        locale: Entry.locale
      },
      workspace,
      root,
      status: 'preferDraft'
    })
    .then(rows => {
      return (rows as Array<DashboardEntry>).sort((a, b) =>
        String(a.title || '').localeCompare(String(b.title || ''))
      )
    })
  entriesPromises.set(key, promise)
  return promise
}

export function useEntries(
  workspace: string,
  root: string
): Array<DashboardEntry> {
  const {db} = useApp()
  const promise = useMemo(
    () => entriesPromise(db, workspace, root),
    [db, workspace, root]
  )
  return readPromise(promise)
}
