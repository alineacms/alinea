import {sign, verify} from '#/core/util/JWT.js'
import type {Previews, PreviewToken} from '../Previews.js'

export class JWTPreviews implements Previews {
  constructor(private secret: string) {}

  sign(): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000)
    return sign(
      {
        purpose: 'preview',
        issuedAt,
        expiresAt: issuedAt + 300,
        exp: issuedAt + 300,
        iat: issuedAt
      },
      this.secret
    )
  }

  verify(token: string): Promise<PreviewToken> {
    return verify(token, this.secret)
  }
}
