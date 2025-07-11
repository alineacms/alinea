export interface PreviewInfo {
  url: string
}

export interface Previews {
  sign(data: PreviewInfo): Promise<string>
  verify(token: string): Promise<PreviewInfo>
}
