import {Workspaces} from '.'
import {Hub} from './Hub'
import {User} from './User'

export interface Session<T extends Workspaces = Workspaces> {
  hub: Hub<T>
  user: User
  end: () => Promise<void>
}
