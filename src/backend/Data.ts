import {Entry, Hub} from 'alinea/core'

export namespace Data {
  export interface Source {
    entries(): AsyncGenerator<Entry>
    watchFiles?: () => Promise<{files: Array<string>; dirs: Array<string>}>
  }

  export interface Target {
    canRename: boolean
    publish(params: Hub.ChangesParams, ctx: Hub.Context): Promise<void>
  }

  export interface Media {
    upload(params: Hub.MediaUploadParams, ctx: Hub.Context): Promise<string>
    download(
      params: Hub.DownloadParams,
      ctx: Hub.Context
    ): Promise<Hub.Download>
  }
}
