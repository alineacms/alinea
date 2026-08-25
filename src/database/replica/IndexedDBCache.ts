import type {DatabaseRecord} from '../Database.js'
import type {DecodedObjectCache} from '../Reader.js'
import type {CiphertextCache} from './Bundle.js'
import type {BundleId, FrameDescriptor, ReplicaState} from './Types.js'

const CIPHERTEXT = 'ciphertext'
const OBJECTS = 'objects'
const STATES = 'states'

/** Persistent dashboard cache; catalogs are installed with one atomic put. */
export class IndexedDBReplicaCache<Row extends DatabaseRecord>
  implements CiphertextCache, DecodedObjectCache<Row>
{
  #factory: IDBFactory
  #name: string
  #connection?: Promise<IDBDatabase>

  constructor(factory: IDBFactory, name = 'alinea-replica') {
    this.#factory = factory
    this.#name = name
  }

  get(
    bundleId: BundleId,
    frame: FrameDescriptor
  ): Promise<Uint8Array | undefined>
  get(scope: string, revision: string, id: string): Promise<Row | undefined>
  get(
    scope: string,
    revisionOrFrame: string | FrameDescriptor,
    id?: string
  ): Promise<Row | Uint8Array | undefined> {
    return typeof revisionOrFrame === 'string'
      ? this.#read<Row>(OBJECTS, objectKey(scope, revisionOrFrame, id!))
      : this.#read<Uint8Array>(CIPHERTEXT, frameKey(scope, revisionOrFrame))
  }

  put(
    bundleId: BundleId,
    frame: FrameDescriptor,
    ciphertext: Uint8Array
  ): Promise<void>
  put(scope: string, revision: string, id: string, value: Row): Promise<void>
  put(
    scope: string,
    revisionOrFrame: string | FrameDescriptor,
    idOrValue: string | Uint8Array,
    value?: Row
  ): Promise<void> {
    return typeof revisionOrFrame === 'string'
      ? this.#write(
          OBJECTS,
          objectKey(scope, revisionOrFrame, idOrValue as string),
          value
        )
      : this.#write(CIPHERTEXT, frameKey(scope, revisionOrFrame), idOrValue)
  }

  delete(bundleId: BundleId, frame: FrameDescriptor): Promise<void> {
    return this.#delete(CIPHERTEXT, frameKey(bundleId, frame))
  }

  async installState(scope: string, state: ReplicaState): Promise<void> {
    await this.#write(STATES, scope, state)
  }

  state(scope: string): Promise<ReplicaState | undefined> {
    return this.#read(STATES, scope)
  }

  async #connect(): Promise<IDBDatabase> {
    if (!this.#connection) {
      this.#connection = new Promise((resolve, reject) => {
        const request = this.#factory.open(this.#name, 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
        request.onupgradeneeded = () => {
          const database = request.result
          database.createObjectStore(CIPHERTEXT)
          database.createObjectStore(OBJECTS)
          database.createObjectStore(STATES)
        }
      })
    }
    return this.#connection
  }

  async #read<Value>(
    storeName: string,
    key: string
  ): Promise<Value | undefined> {
    const database = await this.#connect()
    return new Promise((resolve, reject) => {
      const request = database
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .get(key)
      request.onsuccess = () => resolve(request.result as Value | undefined)
      request.onerror = () => reject(request.error)
    })
  }

  async #write(storeName: string, key: string, value: unknown): Promise<void> {
    const database = await this.#connect()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).put(value, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }

  async #delete(storeName: string, key: string): Promise<void> {
    const database = await this.#connect()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
}

function frameKey(bundleId: BundleId, frame: FrameDescriptor): string {
  return `${bundleId}\0${frame.id}\0${frame.cipherHash}`
}

function objectKey(scope: string, revision: string, id: string): string {
  return `${scope}\0${revision}\0${id}`
}
