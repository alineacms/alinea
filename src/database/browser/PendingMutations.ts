import {crypto} from '@alinea/iso'
import {createId} from '#/core/Id.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {sha256Hash} from '#/core/source/Utils.js'
import {isRecord} from '#/core/util/Objects.js'
import {canonicalJson} from '../replica/Operations.js'
import {idbResult, idbTransaction} from './IndexedDB.js'

/** Caller must obtain this binding from an authenticated replica, not a URL alone. */
export interface PendingScope {
  project: string
  namespace: string
  epoch: string
  principal: string
  endpoint: string
}

export interface PendingMutationInput {
  id: string
  baseRevision: string
  schemaId: string
  configId: string
  mutations: Array<Mutation>
}

export interface PendingMutation extends PendingMutationInput {
  digest: string
  createdAt: number
  order: number
  acceptedSha?: string
}

interface Encrypted {
  nonce: Uint8Array
  ciphertext: ArrayBuffer
}

interface StoredMutation {
  id: string
  digest: string
  order: number
  body: Encrypted
  acceptance?: Encrypted
}

interface State {
  generation: string
  key: CryptoKey
  order: number
  bytes: number
  count: number
}

const encoder = new TextEncoder()
const maximumMutationBytes = 16 * 1024 * 1024
const maximumQueueBytes = 64 * 1024 * 1024

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096
}

/** Local encrypted drafts, separate from the ciphertext-only content cache.
 * The device key is persisted as a non-extractable CryptoKey. This does not
 * defend against malicious same-origin code; authentication/purge remain required.
 * Storage never submits edits or assumes a changed schema can safely replay them.
 */
export class PendingMutations {
  #db: IDBDatabase
  #binding: string
  #generation: string
  #key?: CryptoKey

  private constructor(db: IDBDatabase, binding: string, state: State) {
    this.#db = db
    this.#binding = binding
    this.#generation = state.generation
    this.#key = state.key
    db.onversionchange = () => this.close()
  }

  static async open(
    factory: IDBFactory,
    scope: PendingScope
  ): Promise<PendingMutations> {
    const endpoint = new URL(scope.endpoint)
    if (
      !['https:', 'http:'].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      throw new Error('Invalid pending mutation endpoint')
    const parts = [
      scope.project,
      scope.namespace,
      scope.epoch,
      scope.principal,
      endpoint.href
    ]
    if (!parts.every(text)) throw new Error('Incomplete pending mutation scope')
    const binding = JSON.stringify(parts)
    const name = `alinea-pending-1:${await sha256Hash(encoder.encode(binding))}`
    const candidate = await crypto.subtle.generateKey(
      {name: 'AES-GCM', length: 256},
      false,
      ['encrypt', 'decrypt']
    )
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 1)
      let blocked = false
      request.onblocked = () => {
        blocked = true
        reject(new Error('Pending mutation storage blocked'))
      }
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('state')
        request.result.createObjectStore('mutations')
      }
      request.onsuccess = () => {
        if (blocked) request.result.close()
        else resolve(request.result)
      }
    })
    try {
      const state = await idbTransaction(
        db,
        ['state'],
        'readwrite',
        async tx => {
          const store = tx.objectStore('state')
          const current = await idbResult<State | undefined>(
            store.get('current')
          )
          if (current) return current
          const state: State = {
            generation: createId(),
            key: candidate,
            order: 0,
            bytes: 0,
            count: 0
          }
          store.put(state, 'current')
          return state
        }
      )
      return new PendingMutations(db, binding, state)
    } catch (error) {
      db.close()
      throw error
    }
  }

  async #transaction<T>(
    mode: IDBTransactionMode,
    run: (tx: IDBTransaction, state: State) => Promise<T>
  ): Promise<T> {
    if (!this.#key) throw new Error('Pending mutation store is closed')
    return idbTransaction(this.#db, ['state', 'mutations'], mode, async tx => {
      const state = await idbResult<State | undefined>(
        tx.objectStore('state').get('current')
      )
      if (state?.generation !== this.#generation)
        throw new Error('Pending mutation store was invalidated')
      return run(tx, state)
    })
  }

  #aad(id: string, digest: string, kind: string): Uint8Array {
    return encoder.encode(
      JSON.stringify([this.#binding, this.#generation, id, digest, kind])
    )
  }

  async #encrypt(
    id: string,
    digest: string,
    kind: string,
    value: string
  ): Promise<Encrypted> {
    if (!this.#key) throw new Error('Pending mutation store is closed')
    const nonce = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: this.#aad(id, digest, kind) as BufferSource
      },
      this.#key,
      encoder.encode(value)
    )
    return {nonce, ciphertext}
  }

  async #decrypt(
    row: StoredMutation,
    kind: string,
    value: Encrypted
  ): Promise<unknown> {
    if (!this.#key) throw new Error('Pending mutation store is closed')
    if (
      !(value.nonce instanceof Uint8Array) ||
      value.nonce.byteLength !== 12 ||
      !(value.ciphertext instanceof ArrayBuffer) ||
      value.ciphertext.byteLength > maximumMutationBytes + 16
    )
      throw new Error('Invalid encrypted pending mutation')
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: value.nonce as BufferSource,
        additionalData: this.#aad(row.id, row.digest, kind) as BufferSource
      },
      this.#key,
      value.ciphertext
    )
    return JSON.parse(new TextDecoder().decode(plaintext))
  }

  async #decode(row: StoredMutation): Promise<PendingMutation> {
    const body = await this.#decrypt(row, 'body', row.body)
    if (
      !isRecord(body) ||
      !text(body.baseRevision) ||
      !text(body.schemaId) ||
      !text(body.configId) ||
      !Array.isArray(body.mutations) ||
      typeof body.createdAt !== 'number'
    )
      throw new Error('Invalid pending mutation body')
    const acceptedSha = row.acceptance
      ? await this.#decrypt(row, 'acceptance', row.acceptance)
      : undefined
    if (acceptedSha !== undefined && !text(acceptedSha))
      throw new Error('Invalid pending mutation acceptance')
    return {
      id: row.id,
      digest: row.digest,
      order: row.order,
      createdAt: body.createdAt,
      baseRevision: body.baseRevision,
      schemaId: body.schemaId,
      configId: body.configId,
      mutations: body.mutations as Array<Mutation>,
      ...(acceptedSha === undefined ? {} : {acceptedSha})
    }
  }

  async list(): Promise<Array<PendingMutation>> {
    const rows = await this.#transaction('readonly', tx =>
      idbResult<Array<StoredMutation>>(tx.objectStore('mutations').getAll())
    )
    const values = await Promise.all(
      rows.sort((a, b) => a.order - b.order).map(row => this.#decode(row))
    )
    // A logout/close during decryption must not release the old plaintext.
    await this.#transaction('readonly', async () => {})
    return values
  }

  async enqueue(input: PendingMutationInput): Promise<PendingMutation> {
    const {id, baseRevision, schemaId, configId} = input
    if (
      ![id, baseRevision, schemaId, configId].every(text) ||
      !Array.isArray(input.mutations) ||
      !input.mutations.length ||
      input.mutations.length > 4096
    )
      throw new Error('Invalid pending mutation')
    // Match the Graph client's JSON transport, including omitted optional fields.
    const mutations = JSON.parse(
      JSON.stringify(input.mutations)
    ) as Array<Mutation>
    const serialized = canonicalJson({
      baseRevision,
      schemaId,
      configId,
      mutations,
      createdAt: Date.now()
    })
    if (encoder.encode(serialized).byteLength > maximumMutationBytes)
      throw new Error('Pending mutation exceeds byte limit')
    const digest = await sha256Hash(encoder.encode(canonicalJson(mutations)))
    const body = await this.#encrypt(id, digest, 'body', serialized)
    const row = await this.#transaction('readwrite', async (tx, state) => {
      const store = tx.objectStore('mutations')
      const previous = await idbResult<StoredMutation | undefined>(
        store.get(id)
      )
      if (previous) return previous
      if (
        state.count >= 128 ||
        state.bytes + body.ciphertext.byteLength > maximumQueueBytes
      )
        throw new Error('Pending mutation queue is full')
      const row: StoredMutation = {id, digest, body, order: state.order + 1}
      store.add(row, id)
      tx.objectStore('state').put(
        {
          ...state,
          order: row.order,
          count: state.count + 1,
          bytes: state.bytes + body.ciphertext.byteLength
        },
        'current'
      )
      return row
    })
    const result = await this.#decode(row)
    if (
      result.digest !== digest ||
      result.baseRevision !== baseRevision ||
      result.schemaId !== schemaId ||
      result.configId !== configId
    )
      throw new Error('Pending transaction ID was already used')
    await this.#transaction('readonly', async () => {})
    return result
  }

  async accept(id: string, digest: string, sha: string): Promise<void> {
    if (!text(sha)) throw new Error('Invalid accepted revision')
    const acceptance = await this.#encrypt(
      id,
      digest,
      'acceptance',
      JSON.stringify(sha)
    )
    const row = await this.#transaction('readwrite', async (tx, state) => {
      const store = tx.objectStore('mutations')
      const row = await idbResult<StoredMutation | undefined>(store.get(id))
      if (!row || row.digest !== digest)
        throw new Error('Pending transaction does not match')
      if (!row.acceptance) {
        if (state.bytes + acceptance.ciphertext.byteLength > maximumQueueBytes)
          throw new Error('Pending mutation queue is full')
        row.acceptance = acceptance
        store.put(row, id)
        tx.objectStore('state').put(
          {...state, bytes: state.bytes + acceptance.ciphertext.byteLength},
          'current'
        )
      }
      return row
    })
    if ((await this.#decode(row)).acceptedSha !== sha)
      throw new Error('Pending transaction was accepted at another revision')
    await this.#transaction('readonly', async () => {})
  }

  /** Caller removes an acknowledged/refreshed edit, or explicitly discards intent. */
  remove(id: string, digest: string): Promise<void> {
    return this.#transaction('readwrite', async (tx, state) => {
      const store = tx.objectStore('mutations')
      const row = await idbResult<StoredMutation | undefined>(store.get(id))
      if (!row) return
      if (row.digest !== digest)
        throw new Error('Pending transaction does not match')
      store.delete(id)
      tx.objectStore('state').put(
        {
          ...state,
          count: state.count - 1,
          bytes:
            state.bytes -
            row.body.ciphertext.byteLength -
            (row.acceptance?.ciphertext.byteLength ?? 0)
        },
        'current'
      )
    })
  }

  async purge(): Promise<void> {
    await this.#transaction('readwrite', async tx => {
      tx.objectStore('mutations').clear()
      tx.objectStore('state').clear()
    })
    this.close()
  }

  close(): void {
    this.#key = undefined
    this.#db.close()
  }
}
