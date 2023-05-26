import {sign, verify} from 'alinea/core/util/JWT'
import {Previews} from '../Previews.js'

export class JWTPreviews implements Previews {
  constructor(private secret: string) {}

  sign(data: {sub: string}): Promise<string> {
    return sign(data, this.secret)
  }

  verify(token: string): Promise<{sub: string}> {
    return verify(token, this.secret)
  }
}
