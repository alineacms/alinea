import {sign, verify} from 'alinea/core/util/JWT'
import {Previews} from '../Previews.js'

export class JWTPreviews implements Previews {
  constructor(private secret: string) {}

  sign(data: {id: string; url: string}): Promise<string> {
    return sign(data, this.secret)
  }

  verify(token: string): Promise<{id: string; url: string}> {
    return verify(token, this.secret)
  }
}
