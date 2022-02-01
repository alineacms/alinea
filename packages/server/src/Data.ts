import {Entry} from '@alinea/core/Entry'

export namespace Data {
  export interface Source {
    entries(): AsyncGenerator<Entry>
  }

  export interface Target {
    publish(entries: Array<Entry>): Promise<void>
  }

  export interface Media {
    upload(file: Media.Upload): Promise<string>
    download(location: string): Promise<Media.Download>
  }

  export namespace Media {
    export type Upload = {path: string; buffer: ArrayBuffer; preview?: string}
    export type Download =
      | {type: 'buffer'; buffer: ArrayBuffer}
      | {type: 'url'; url: string}
  }
}
