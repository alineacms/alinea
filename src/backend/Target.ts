import type {Connection} from 'alinea/core/Connection'

export interface Target {
  mutate(
    params: Connection.MutateParams,
    ctx: Connection.Context
  ): Promise<{commitHash: string}>
}
