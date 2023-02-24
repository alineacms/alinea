import {Hub} from './Hub.js'
import {User} from './User.js'

export interface Session<T = any> {
  hub: Hub<T>
  user: User
  end: () => Promise<void>
}
