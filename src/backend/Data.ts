import {Entry, Hub} from 'alinea/core'

export namespace Data {
  export interface Source {
    entries(): AsyncGenerator<Entry>
    watchFiles?: () => Promise<{files: Array<string>; dirs: Array<string>}>
  }

  /*export namespace Source {
    export function concat(...sources: Array<Source>): Source {
      return {
        async *entries(): AsyncGenerator<Entry> {
          for (const source of sources) {
            for await (const entry of source.entries()) {
              yield entry
            }
          }
        },
        async watchFiles() {
          const res = await Promise.all(
            sources.map(source => source.watchFiles?.() || [])
          )
          return res.flat()
        }
      }
    }
  }*/

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
