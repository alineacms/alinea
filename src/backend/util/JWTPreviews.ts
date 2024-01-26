import {User} from 'alinea/core'
import {sign, verify} from 'alinea/core/util/JWT'
import {Previews} from '../Previews.js'

export class JWTPreviews implements Previews {
  constructor(private secret: string) {}

  sign(data: User): Promise<string> {
    return sign(data, this.secret)
  }

  verify(token: string): Promise<User> {
    return verify(token, this.secret)
  }
}
