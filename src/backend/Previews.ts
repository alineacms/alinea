export type PreviewTokenPayload = {sub: string} | {anonymous: true}

export interface Previews {
  sign(data: PreviewTokenPayload): Promise<string>
  verify(token: string): Promise<PreviewTokenPayload>
}
