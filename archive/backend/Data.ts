import {Connection, Entry} from 'alinea/core'

export namespace Data {
  export interface Source {
    entries(): AsyncGenerator<Entry>
    watchFiles?: () => Promise<{files: Array<string>; dirs: Array<string>}>
  }

  export interface Target {
    canRename: boolean
    publish(
      params: Connection.ChangesParams,
      ctx: Connection.Context
    ): Promise<void>
  }

  export interface Media {
    upload(
      params: Connection.MediaUploadParams,
      ctx: Connection.Context
    ): Promise<string>
    download(
      params: Connection.DownloadParams,
      ctx: Connection.Context
    ): Promise<Connection.Download>
  }
}
