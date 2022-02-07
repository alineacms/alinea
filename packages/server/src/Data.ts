import {Entry} from '@alinea/core/Entry'

export namespace Data {
  export interface Source {
    entries(): AsyncGenerator<Entry>
  }

  export interface Target {
    publish(entries: Array<Entry>): Promise<void>
  }

  export interface Media {
    upload(workspace: string, file: Media.Upload): Promise<string>
    download(workspace: string, location: string): Promise<Media.Download>
  }

  export namespace Media {
    export type Upload = {
      path: string
      buffer: ArrayBuffer
      preview?: string
      color?: string
    }
    export type Download =
      | {type: 'buffer'; buffer: ArrayBuffer}
      | {type: 'url'; url: string}
  }
}
