export interface PreviewInfo {
  locale: string | null
  entryId: string
}

export interface Previews {
  sign(data: PreviewInfo): Promise<string>
  verify(token: string): Promise<PreviewInfo>
}
