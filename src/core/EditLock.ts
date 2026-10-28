import type {User} from './User.js'

/** Editors that stop sending heartbeats are forgotten after this long */
export const lockExpiry = 45_000
/** The holder has this long to answer a request before control passes */
export const lockTimeout = 30_000

export interface EditorUser {
  sub: string
  name?: string
  email?: string
}

export interface Editor {
  /** One per open dashboard tab */
  session: string
  user: EditorUser
  seenAt: number
}

export interface EditRequest extends Editor {
  askedAt: number
}

/** What a store keeps per entry and locale */
export interface EditLock {
  holder?: Editor
  request?: EditRequest
  /** The session whose request the holder declined */
  declined?: string
}

/** Sent every few seconds by each open entry editor */
export interface Heartbeat {
  entryId: string
  locale: string | null
  session: string
  /** Sent with every heartbeat while waiting for control */
  ask?: boolean
  /** The holder's answer to the pending request */
  answer?: 'allow' | 'decline'
  /** The editor closed */
  leave?: boolean
}

/** Durations are relative, so the clocks of server and browser can differ */
export interface EditStatus {
  holds: boolean
  /** The editor holding the entry when it is not this session */
  holder?: {user: EditorUser; idle: number}
  /** A pending request, control passes in `remaining` ms */
  request?: {user: EditorUser; mine: boolean; remaining: number}
  /** The holder declined the request of this session */
  declined?: boolean
}

export function lockKey({entryId, locale}: Heartbeat): string {
  return locale ? `${entryId}.${locale}` : entryId
}

/** Until when a store keeps a lock */
export function lockExpires(lock: EditLock): number {
  const seenAt = Math.max(lock.holder?.seenAt ?? 0, lock.request?.seenAt ?? 0)
  return seenAt + lockExpiry
}

/**
 * Applies a heartbeat. A session claims the entry when nobody holds it, which
 * also re-claims it after the store lost its locks.
 */
export function nextLock(
  lock: EditLock | undefined,
  beat: Heartbeat,
  user: User,
  now: number
): [lock: EditLock | undefined, status: EditStatus] {
  const me: Editor = {
    session: beat.session,
    user: {sub: user.sub, name: user.name, email: user.email},
    seenAt: now
  }
  const live = <T extends Editor>(editor?: T) =>
    editor && now - editor.seenAt < lockExpiry ? editor : undefined
  let holder = live(lock?.holder)
  let request = live(lock?.request)
  let declined = lock?.declined
  const isMine = (editor?: Editor) => editor?.session === me.session
  const wasDeclined = declined === me.session
  if (wasDeclined) declined = undefined
  if (beat.leave) {
    if (isMine(holder)) holder = undefined
    if (isMine(request)) request = undefined
    return [stored({holder, request, declined}), {holds: false}]
  }
  if (!holder || isMine(holder)) {
    holder = me
    if (isMine(request)) request = undefined
    if (request && beat.answer === 'allow') {
      holder = asHolder(request)
      request = undefined
    } else if (request && beat.answer === 'decline') {
      declined = request.session
      request = undefined
    }
  } else if (wasDeclined || !beat.ask) {
    if (isMine(request)) request = undefined
  } else if (holder.user.sub === me.user.sub) {
    // The same user in another tab takes over right away
    holder = me
    request = undefined
  } else if (!request || isMine(request)) {
    request = {...me, askedAt: request?.askedAt ?? now}
  }
  if (request && now - request.askedAt >= lockTimeout) {
    holder = asHolder(request)
    request = undefined
  }
  const holds = isMine(holder)
  const status: EditStatus = {holds}
  if (!holds) status.holder = {user: holder.user, idle: now - holder.seenAt}
  if (request)
    status.request = {
      user: request.user,
      mine: isMine(request),
      remaining: lockTimeout - (now - request.askedAt)
    }
  if (wasDeclined && beat.ask && !holds) status.declined = true
  return [stored({holder, request, declined}), status]
}

function asHolder({session, user, seenAt}: Editor): Editor {
  return {session, user, seenAt}
}

function stored(lock: EditLock): EditLock | undefined {
  if (!lock.holder && !lock.request) return undefined
  return lock
}
