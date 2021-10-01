import {Hub} from '.'
import {User} from './User'

export interface Session {
  hub: Hub
  user: User
  logout(): Promise<void>
}
