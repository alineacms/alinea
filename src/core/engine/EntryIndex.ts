import type {Config} from '../Config.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import type {ChangesBatch} from '../source/Change.js'
import type {Source} from '../source/Source.js'
import type {EntrySnapshot} from './EntrySnapshot.js'
import {createEntrySnapshot} from './EntrySnapshotBuilder.js'
import {EntryTransaction} from './EntryTransaction.js'
import {SnapshotEntryPlanner} from './SnapshotEntryPlanner.js'

export class EntryIndex extends BaseEntryIndex {
  readonly #config: Config
  #snapshot: EntrySnapshot | undefined
  #planner: SnapshotEntryPlanner | undefined
  #plannerSnapshot: EntrySnapshot | undefined

  constructor(config: Config) {
    super(config)
    this.#config = config
  }

  override async syncWith(source: Source): Promise<string> {
    return super.syncWith(source)
  }

  override async indexChanges(batch: ChangesBatch) {
    return super.indexChanges(batch)
  }

  override async transaction(source: Source) {
    const from = await source.getTree()
    return new EntryTransaction(this.#config, this, source, from)
  }

  get snapshot() {
    if (this.#snapshot?.graphSha === this.sha) return this.#snapshot
    this.#snapshot = createEntrySnapshot(this.#config, this)
    this.#planner = undefined
    this.#plannerSnapshot = undefined
    return this.#snapshot
  }

  get planner() {
    const snapshot = this.snapshot
    if (this.#planner && this.#plannerSnapshot === snapshot)
      return this.#planner
    this.#plannerSnapshot = snapshot
    return (this.#planner = new SnapshotEntryPlanner(snapshot))
  }
}
