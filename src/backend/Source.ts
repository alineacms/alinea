export interface SourceEntry {
  workspace: string
  root: string
  filePath: string
  contents: Uint8Array | object
  modifiedAt: number
}

export interface Source {
  entries(): AsyncGenerator<SourceEntry>
  // watch?: () => Emitter<SourceEntry>
}
