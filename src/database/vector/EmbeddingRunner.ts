import pLimit from 'p-limit'
import {canonicalJson} from '#/core/util/Json.js'
import {
  embeddingHash,
  validateEmbeddingSpace,
  ObsoleteEmbeddingJobError,
  type EmbeddingJob,
  type EmbeddingSpace
} from './Embedding.js'
import {prepareEmbeddingInput, type EmbeddingInput} from './EmbeddingInput.js'
import type {EmbeddingStore} from './EmbeddingStore.js'

export interface EmbeddingProvider {
  space: EmbeddingSpace
  /** Providers must honor cancellation; this runner never opens a network connection itself. */
  embed(
    input: EmbeddingInput,
    signal: AbortSignal
  ): Promise<{spaceId: string; vector: ReadonlyArray<number>}>
}

export interface EmbeddingRunnerOptions {
  store: EmbeddingStore
  provider: EmbeddingProvider
  /** Resolve immutable input for this owner payload/chunk, or undefined if obsolete. */
  load(
    job: EmbeddingJob,
    signal: AbortSignal
  ): Promise<EmbeddingInput | undefined>
  concurrency?: number
}

export interface EmbeddingRunResult {
  id: string
  generation: string
  status: 'installed' | 'ready' | 'obsolete' | 'failed' | 'cancelled'
  /** Internal diagnostic only; never forward provider errors as public payloads. */
  error?: Error
}

/** Explicit background batches, not part of saving content. Pending jobs survive
 * runner restart in SQL. No automatic retry loop or distributed provider lease.
 */
export class EmbeddingRunner {
  #options: EmbeddingRunnerOptions
  #space: EmbeddingSpace
  #spaceId?: string
  #abort = new AbortController()
  #closed = false
  #running?: Promise<Array<EmbeddingRunResult>>
  #closing?: Promise<void>

  constructor(options: EmbeddingRunnerOptions) {
    const concurrency = options.concurrency ?? 2
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
      throw new Error('Invalid embedding concurrency')
    this.#options = {...options, concurrency}
    this.#space = structuredClone(options.provider.space)
    validateEmbeddingSpace(this.#space)
  }

  run(limit = 128): Promise<Array<EmbeddingRunResult>> {
    if (this.#closed)
      return Promise.reject(new Error('Embedding runner is closed'))
    if (this.#running) return this.#running
    const run = (async () => {
      this.#spaceId ??= await embeddingHash(this.#space)
      const jobs = await this.#options.store.pending(this.#spaceId, limit)
      const schedule = pLimit(this.#options.concurrency!)
      return Promise.all(jobs.map(job => schedule(() => this.#job(job))))
    })()
    this.#running = run
    void run
      .finally(() => {
        if (this.#running === run) this.#running = undefined
      })
      .catch(() => {})
    return run
  }

  async #current(job: EmbeddingJob): Promise<'pending' | 'ready' | 'obsolete'> {
    const current = await this.#options.store.manifest(job.id)
    if (
      !current ||
      current.generation !== job.generation ||
      current.spaceId !== job.spaceId ||
      canonicalJson(current.target) !== canonicalJson(job.target)
    )
      return 'obsolete'
    return current.payloadId ? 'ready' : 'pending'
  }

  async #job(job: EmbeddingJob): Promise<EmbeddingRunResult> {
    const {id, generation} = job
    const signal = this.#abort.signal
    try {
      signal.throwIfAborted()
      let current = await this.#current(job)
      if (current !== 'pending') return {id, generation, status: current}
      const value = await this.#options.load(structuredClone(job), signal)
      signal.throwIfAborted()
      if (!value) return {id, generation, status: 'obsolete'}
      const {input, hash} = await prepareEmbeddingInput(value)
      if (hash !== job.target.sourceHash)
        return {id, generation, status: 'obsolete'}
      current = await this.#current(job)
      if (current !== 'pending') return {id, generation, status: current}
      signal.throwIfAborted()
      const result = await this.#options.provider.embed(input, signal)
      signal.throwIfAborted()
      if (result.spaceId !== job.spaceId)
        throw new Error('Embedding provider returned a different model space')
      current = await this.#current(job)
      if (current !== 'pending') return {id, generation, status: current}
      signal.throwIfAborted()
      const installed = await this.#options.store.install(
        job,
        result.vector,
        signal
      )
      return {id, generation, status: installed ? 'installed' : 'ready'}
    } catch (error) {
      if (signal.aborted) return {id, generation, status: 'cancelled'}
      if (error instanceof ObsoleteEmbeddingJobError)
        return {id, generation, status: 'obsolete'}
      return {
        id,
        generation,
        status: 'failed',
        error:
          error instanceof Error
            ? error
            : new Error('Embedding provider failed')
      }
    }
  }

  /** Drain actual provider calls; abort-ignoring providers can delay shutdown. */
  close(): Promise<void> {
    this.#closed = true
    this.#abort.abort(new Error('Embedding runner closed'))
    return (this.#closing ??= (this.#running ?? Promise.resolve()).then(
      () => {},
      () => {}
    ))
  }
}
