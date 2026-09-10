import type {User} from '../User.js'
import type {WritableGraph} from './WritableGraph.js'

export interface GraphSession {
  authenticate(user: User): Promise<void>
  disconnect(purge?: boolean): Promise<void>
}

export class GraphSessionAbort extends Error {
  constructor(readonly purge: boolean) {
    super('Dashboard replica disconnected')
  }
}

export function graphSession(graph: WritableGraph): GraphSession | undefined {
  const session = graph as WritableGraph & Partial<GraphSession>
  if (
    typeof session.authenticate === 'function' &&
    typeof session.disconnect === 'function'
  )
    return session as WritableGraph & GraphSession
}
