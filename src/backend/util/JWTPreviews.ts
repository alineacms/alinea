import {sign, verify} from '#/core/util/JWT.js'
import {isRecord} from '#/core/util/Objects.js'
import type {Previews} from '../Previews.js'

const previewTokenLifetime = 5 * 60

export class JWTPreviews implements Previews {
  constructor(private secret: string) {}

  sign(): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000)
    return sign(
      {
        purpose: 'preview',
        exp: issuedAt + previewTokenLifetime,
        iat: issuedAt
      },
      this.secret
    )
  }

  async verify(token: string): Promise<void> {
    const payload = await verify(token, this.secret)
    if (
      !isRecord(payload) ||
      payload.purpose !== 'preview' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      throw new Error('Invalid preview token')
    }
  }
}
