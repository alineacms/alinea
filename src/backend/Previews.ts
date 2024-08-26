export interface PreviewInfo {
  entryId: string
  contentHash: string
  phase: string
}

export interface Previews {
  sign(data: PreviewInfo): Promise<string>
  verify(token: string): Promise<PreviewInfo>
}
