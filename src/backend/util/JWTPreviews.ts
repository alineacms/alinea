import {sign, verify} from 'alinea/core/util/JWT'
import type {PreviewInfo, Previews} from '../Previews.js'

export class JWTPreviews implements Previews {
  constructor(private secret: string) {}

  sign(data: PreviewInfo): Promise<string> {
    return sign(data, this.secret)
  }

  verify(token: string): Promise<PreviewInfo> {
    return verify(token, this.secret)
  }
}
