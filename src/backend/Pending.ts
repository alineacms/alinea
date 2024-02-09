import type {Connection} from 'alinea/core/Connection'
import type {Mutation} from 'alinea/core/Mutation'

export interface Pending {
  pendingSince(
    commitHash: string,
    ctx: Connection.Context
  ): Promise<{toCommitHash: string; mutations: Array<Mutation>} | undefined>
}
