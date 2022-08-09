import {Drafts} from '@alinea/backend/Drafts'
import {FileDrafts, FileDraftsOptions} from '@alinea/backend/drafts/FileDrafts'
import {createDb} from '@alinea/backend/util/CreateDb'
import {Config} from '@alinea/core/Config'
import {Hub} from '@alinea/core/Hub'
import {base64} from '@alinea/core/util/Encoding'
import {Collection} from '@alinea/store/Collection'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import path from 'node:path'
import {exportStore} from '../ExportStore'

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
    const store = await createDb()
    for await (const update of this.updates()) {
      store.insert(Draft, {
        id: update.id,
        draft: base64.stringify(update.update)
      })
    }
    await exportStore(store, this.location)
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
