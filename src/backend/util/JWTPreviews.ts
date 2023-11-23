import {sign, verify} from 'alinea/core/util/JWT'
import {PreviewTokenPayload, Previews} from '../Previews.js'

export class JWTPreviews implements Previews {
  constructor(private secret: string) {}

  sign(data: PreviewTokenPayload): Promise<string> {
    return sign(data, this.secret)
  }

  verify(token: string): Promise<PreviewTokenPayload> {
    return verify(token, this.secret)
  }
}
