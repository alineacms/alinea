import {Connection} from 'alinea/core'
import {Mutation} from 'alinea/core/Mutation'

export interface Pending {
  pendingSince(
    contentHash: string,
    ctx: Connection.Context
  ): Promise<Array<Mutation>>
}
