import {Mutation} from 'alinea/core/Mutation'

export interface Pending {
  pendingSince(contentHash: string): Promise<Array<Mutation>>
}
