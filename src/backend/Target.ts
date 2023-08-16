import {Connection} from 'alinea/core'

export interface Target {
  canRename: boolean
  mutate(
    params: Connection.MutateParams,
    ctx: Connection.Context
  ): Promise<void>
}
