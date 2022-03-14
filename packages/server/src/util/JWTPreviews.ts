import jwt from 'jsonwebtoken'
import {Previews} from '../Previews'

export class JWTPreviews implements Previews {
  constructor(private secret: string) {}

  sign(data: {id: string}): string {
    return jwt.sign(data, this.secret)
  }

  verify(token: string) {
    return jwt.verify(token, this.secret) as {id: string}
  }
}
