import type {DatabaseSnapshot} from '../Database.js'
import type {EntryAccessPolicy} from '../entry/Access.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'
import type {HandlerKeyCatalog} from '../release/Exporter.js'
import type {ReplicaBootstrap, ReplicaUser} from '../replica/Protocol.js'
import type {ReplicaCatalog, ReplicaState, Revision} from '../replica/Types.js'
import {ReplicaRevisionLog} from './Deltas.js'
import {projectEntryReplicaState} from './EntryProjection.js'

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
  configId: string
  configUrl: string
  cacheKey: string
  release: ReplicaRelease
}

/** Framework-neutral authenticated read plane used by HTTP handler adapters. */
export class ReplicaService {
  readonly revisions = new ReplicaRevisionLog()
  #configId: string
  #configUrl: string
  #cacheKey: string
  #release: ReplicaRelease
  #views = new Map<string, ReplicaState>()

  constructor(options: ReplicaServiceOptions) {
    this.#configId = options.configId
    this.#configUrl = options.configUrl
    this.#cacheKey = options.cacheKey
    this.#release = options.release
  }

  bootstrap(session: AuthenticatedReplicaSession): ReplicaBootstrap {
    return {
      user: session.user,
      configId: this.#configId,
      configUrl: this.#configUrl,
      cacheKey: this.#cacheKey
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

  install(release: ReplicaRelease): void {
    this.#release = release
    this.#views.clear()
    this.revisions.publish(release.catalog.revision)
  }
}
