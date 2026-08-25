import type {DatabaseSnapshot} from '../Database.js'
import type {Config} from '#/core/Config.js'
import type {EntryAccessPolicy} from '../entry/Access.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'
import type {HandlerKeyCatalog} from '../release/Exporter.js'
import type {ReplicaBootstrap, ReplicaUser} from '../replica/Protocol.js'
import type {ReplicaCatalog, ReplicaState, Revision} from '../replica/Types.js'
import type {
  FieldTransaction,
  FieldTransactionResult
} from '../replica/Operations.js'
import {ReplicaRevisionLog} from './Deltas.js'
import {projectEntryReplicaState} from './EntryProjection.js'
import {evaluateRolePolicy, roleFingerprint} from './Policy.js'
import {DatabaseResolver} from '../query/Resolver.js'

export interface ReplicaRelease {
  snapshot: DatabaseSnapshot<AlineaDatabaseRecord>
  catalog: ReplicaCatalog
  keys: HandlerKeyCatalog
}

export interface AuthenticatedReplicaSession {
  user: ReplicaUser
  policy: EntryAccessPolicy
  /** Stable for users whose combined role policies produce the same view. */
  policyFingerprint: string
}

export interface ReplicaServiceOptions {
  config?: Config
  configId: string
  configUrl: string
  cacheKey: string
  release: ReplicaRelease
  mutate?: ReplicaMutationHandler
}

export interface ReplicaMutationHandler {
  (
    session: AuthenticatedReplicaSession,
    transaction: FieldTransaction
  ): Promise<FieldTransactionResult>
}

/** Framework-neutral authenticated read plane used by HTTP handler adapters. */
export class ReplicaService {
  readonly revisions = new ReplicaRevisionLog()
  #configId: string
  #configUrl: string
  #cacheKey: string
  #release: ReplicaRelease
  #config?: Config
  #views = new Map<string, ReplicaState>()
  #mutate?: ReplicaMutationHandler
  #transactions = new Map<string, Promise<FieldTransactionResult>>()

  constructor(options: ReplicaServiceOptions) {
    this.#configId = options.configId
    this.#config = options.config
    this.#configUrl = options.configUrl
    this.#cacheKey = options.cacheKey
    this.#release = options.release
    this.#mutate = options.mutate
  }

  bootstrap(session: AuthenticatedReplicaSession): ReplicaBootstrap {
    return {
      user: session.user,
      configId: this.#configId,
      configUrl: this.#configUrl,
      cacheKey: this.#cacheKey
    }
  }

  async session(user: ReplicaUser): Promise<AuthenticatedReplicaSession> {
    if (!this.#config)
      throw new Error('Replica role evaluation requires handler config')
    const graph = new DatabaseResolver(this.#config, this.#release.snapshot)
    return {
      user,
      policy: await evaluateRolePolicy(this.#config, graph, user.roles),
      policyFingerprint: roleFingerprint(user.roles)
    }
  }

  state(
    session: AuthenticatedReplicaSession,
    knownRevision?: Revision
  ): ReplicaState | undefined {
    if (knownRevision === this.#release.catalog.revision) return undefined
    const cacheKey = `${this.#release.catalog.revision}\0${session.policyFingerprint}`
    let cached = this.#views.get(cacheKey)
    if (!cached) {
      cached = projectEntryReplicaState({
        viewId: session.policyFingerprint,
        policy: session.policy,
        snapshot: this.#release.snapshot,
        catalog: this.#release.catalog,
        keys: this.#release.keys
      })
      this.#views.set(cacheKey, cached)
    }
    return cached
  }

  object(
    session: AuthenticatedReplicaSession,
    id: string
  ): AlineaDatabaseRecord | undefined {
    const state = this.state(session)
    if (!state?.catalog.records[id]) return undefined
    return this.#release.snapshot.get(id)
  }

  mutate(
    session: AuthenticatedReplicaSession,
    transaction: FieldTransaction
  ): Promise<FieldTransactionResult> {
    if (!this.#mutate)
      return Promise.reject(new Error('Replica mutations are not configured'))
    const key = `${session.user.id}\0${transaction.id}`
    let pending = this.#transactions.get(key)
    if (!pending) {
      pending = this.#mutate(session, transaction).catch(error => {
        this.#transactions.delete(key)
        throw error
      })
      this.#transactions.set(key, pending)
    }
    return pending
  }

  install(release: ReplicaRelease): void {
    this.#release = release
    this.#views.clear()
    this.revisions.publish(release.catalog.revision)
  }
}
