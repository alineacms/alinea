import type {User} from 'alinea/core/User'

export interface Previews {
  sign(data: User): Promise<string>
  verify(token: string): Promise<User>
}
