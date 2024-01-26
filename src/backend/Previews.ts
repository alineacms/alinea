import {User} from 'alinea/core'

export interface Previews {
  sign(data: User): Promise<string>
  verify(token: string): Promise<User>
}
