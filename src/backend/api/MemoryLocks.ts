import type {LocksApi} from '#/core/Connection.js'
import {
  type EditLock,
  type EditStatus,
  type Heartbeat,
  lockExpires,
  lockKey,
  nextLock
} from '#/core/EditLock.js'
import type {User} from '#/core/User.js'

/** Locks of a single process, such as the dev server: a restart forgets them */
export class MemoryLocks implements LocksApi {
  #locks = new Map<string, EditLock>()

  async heartbeat(beat: Heartbeat, user: User): Promise<EditStatus> {
    const now = Date.now()
    for (const [key, lock] of this.#locks)
      if (lockExpires(lock) < now) this.#locks.delete(key)
    const key = lockKey(beat)
    const [lock, status] = nextLock(this.#locks.get(key), beat, user, now)
    if (lock) this.#locks.set(key, lock)
    else this.#locks.delete(key)
    return status
  }
}
