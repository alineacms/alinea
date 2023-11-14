import {Connection} from 'alinea/core'

export interface Target {
  mutate(
    params: Connection.MutateParams,
    ctx: Connection.Context
  ): Promise<{commitHash: string}>
}
