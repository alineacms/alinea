import {Cache} from '@alinea/backend/Cache'
import {Drafts} from '@alinea/backend/Drafts'
import {FileDrafts, FileDraftsOptions} from '@alinea/backend/drafts/FileDrafts'
import {accumulate} from '@alinea/core/'
import {Config} from '@alinea/core/Config'
import {Hub} from '@alinea/core/Hub'
import {Collection} from '@alinea/store/Collection'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import path from 'node:path'
import {exportStore} from '../ExportStore'
import {createDb} from '../util/CreateDb'

export interface ServeDraftsOptions extends FileDraftsOptions {
  config: Config
  outDir: string
  store: SqliteStore
}

type Draft = {id: string; draft: string}
const Draft = new Collection<Draft>('Draft')

const FILENAME = 'drafts.js'

export class ServeDrafts extends FileDrafts {
  location: string

  constructor(public options: ServeDraftsOptions) {
    super(options)
    this.location = path.join(this.options.outDir, FILENAME)
  }

  private async write() {
    const data = this.options.store.export()
    const clone = await createDb(data)
    const updates = await accumulate(this.updates())
    Cache.applyUpdates(
      clone,
      this.options.config,
      updates.map(u => [u.id, u.update] as const)
    )
    await exportStore(clone, this.location)
  }

  async update({id, update}: Hub.UpdateParams): Promise<Drafts.Update> {
    const res = await super.update({id, update})
    await this.write()
    return res
  }

  async delete({ids}: Hub.DeleteMultipleParams): Promise<void> {
    await super.delete({ids})
    await this.write()
  }
}
