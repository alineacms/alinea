import {Connection} from 'alinea/core'

export interface Target {
  canRename: boolean
  publish(
    params: Connection.ChangesParams,
    ctx: Connection.Context
  ): Promise<void>
}
