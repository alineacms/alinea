import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {Client} from 'alinea/core/Client'
import {CMS, ConnectionContext} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {alineaCookies} from 'alinea/preview/AlineaCookies'
import {parseChunkedCookies} from 'alinea/preview/ChunkCookieValue'
import {parse} from 'cookie-es'
import type {AsyncLocalStorage} from 'node:async_hooks'

export class VanillaCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  #storage?: AsyncLocalStorage<ConnectionContext>

  async preview<T>(request: Request, run: () => Promise<T>): Promise<T> {
    const {AsyncLocalStorage} = await import('node:async_hooks')
    if (!this.#storage) this.#storage = new AsyncLocalStorage()
    const context: ConnectionContext = {}
    const searchParams = new URL(request.url).searchParams
    const previewToken = searchParams.get('preview')
    const cookieHeader = request.headers.get('cookie')
    if (previewToken && cookieHeader) {
      const cookies = parse(cookieHeader)
      const update = parseChunkedCookies(
        alineaCookies.update,
        Object.entries(cookies).map(([name, value]) => ({name, value}))
      )
      const previews = new JWTPreviews('dev')
      const info = await previews.verify(previewToken)
      context.preview = {...info, update}
    }
    return this.#storage.run(context, run)
  }

  async getContext() {
    return this.#storage?.getStore() ?? {}
  }
}

export function createCMS<Definition extends Config>(config: Definition) {
  const devUrl = process.env.ALINEA_DEV_SERVER
  const cms: VanillaCMS<Definition> = new VanillaCMS(
    config,
    new Client({url: devUrl ?? '/api/cms'})
  )
  return cms
}
