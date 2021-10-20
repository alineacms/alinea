import {Hub} from './Hub'
import {User} from './User'

export interface Session<T = any> {
  hub: Hub<T>
  user: User
  logout?: () => Promise<void>
}
