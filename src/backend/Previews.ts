export interface PreviewInfo {
  /** The initial route kept for compatibility; it is not part of the token. */
  url: string
}

export interface PreviewToken {
  purpose: 'preview'
  issuedAt: number
  expiresAt: number
}

export interface Previews {
  sign(): Promise<string>
  verify(token: string): Promise<PreviewToken>
}
