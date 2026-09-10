export function idbResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Only await IDB requests in run; crypto/network awaits can auto-close the tx. */
export async function idbTransaction<T>(
  db: IDBDatabase,
  stores: Array<string>,
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  signal?.throwIfAborted()
  const tx = db.transaction(stores, mode)
  const abort = () => {
    try {
      tx.abort()
    } catch {}
  }
  signal?.addEventListener('abort', abort, {once: true})
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () =>
      reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
  void done.catch(() => {})
  try {
    const value = await run(tx)
    await done
    signal?.throwIfAborted()
    return value
  } catch (error) {
    abort()
    await done.catch(() => {})
    signal?.throwIfAborted()
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}
