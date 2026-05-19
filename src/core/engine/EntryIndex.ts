import type {Config} from '../Config.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import type {Source} from '../source/Source.js'
import {EntryTransaction} from './EntryTransaction.js'

export class EntryIndex extends BaseEntryIndex {
  readonly #config: Config

  constructor(config: Config) {
    super(config)
    this.#config = config
  }

  override async transaction(source: Source) {
    const from = await source.getTree()
    return new EntryTransaction(this.#config, this, source, from)
  }
}
