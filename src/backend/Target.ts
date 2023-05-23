import {Connection} from 'alinea/core'

export interface Target {
  canRename: boolean
  publishChanges(
    params: Connection.ChangesParams,
    ctx: Connection.Context
  ): Promise<void>
}
