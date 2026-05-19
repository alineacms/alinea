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
  snapshot: EntrySnapshot
  planner: SnapshotEntryPlanner

  constructor(config: Config) {
    super(config)
    this.#config = config
    this.snapshot = createEntrySnapshot(config, this)
    this.planner = new SnapshotEntryPlanner(this.snapshot)
  }

  override async syncWith(source: Source): Promise<string> {
    const sha = await super.syncWith(source)
    this.#refreshSnapshot()
    return sha
  }

  override async indexChanges(batch: ChangesBatch) {
    const sha = await super.indexChanges(batch)
    this.#refreshSnapshot()
    return sha
  }

  override async transaction(source: Source) {
    const from = await source.getTree()
    return new EntryTransaction(this.#config, this, source, from)
  }

  #refreshSnapshot() {
    this.snapshot = createEntrySnapshot(this.#config, this)
    this.planner = new SnapshotEntryPlanner(this.snapshot)
  }
}
