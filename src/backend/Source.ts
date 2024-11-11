export interface SourceEntry {
  locale: string | undefined
  workspace: string
  root: string
  filePath: string
  contents: Uint8Array
  modifiedAt: number
}

export interface WatchFiles {
  files: Array<string>
  dirs: Array<string>
}

export interface Source {
  entries(): AsyncGenerator<SourceEntry>
  watchFiles?: () => Promise<WatchFiles>
}
