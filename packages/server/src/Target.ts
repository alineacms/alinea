import {Entry} from '@alinea/core'

export interface Target {
  publish(entries: Array<Entry>): Promise<void>
}
