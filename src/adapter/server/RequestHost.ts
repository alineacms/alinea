import {draftCookie, hasDraftCookie} from '#/adapter/core/DraftCookie.js'
import {requestContext} from '#/adapter/core/context.js'
import type {
  HostCookie,
  HostRequest,
  ServerHost
} from '#/adapter/core/ServerHost.js'
import type {Config} from '#/core/Config.js'
import {parse} from 'cookie-es'
import {AsyncLocalStorage} from 'node:async_hooks'

const storage = new AsyncLocalStorage<Request>()

/** Run `run` for `request`, so queries in it see its drafts and previews. */
export function withRequest<T>(request: Request, run: () => T): T {
  return storage.run(request, run)
}

class ServerRequest implements HostRequest {
  #config: Config
  #request: Request
  #isDraft: Promise<boolean> | undefined

  constructor(config: Config, request: Request) {
    this.#config = config
    this.#request = request
  }

  async cookies(): Promise<Array<HostCookie>> {
    const header = this.#request.headers.get('cookie')
    if (!header) return []
    return Object.entries(parse(header)).map(([name, value]) => ({
      name,
      value
    }))
  }

  isDraft(): Promise<boolean> {
    return (this.#isDraft ??= (async () => {
      const {apiKey} = await requestContext(this.#config)
      return hasDraftCookie(await this.cookies(), apiKey)
    })())
  }

  async enableDraft(headers: Headers): Promise<void> {
    const {apiKey} = await requestContext(this.#config)
    const secure = new URL(this.#request.url).protocol === 'https:'
    headers.append('set-cookie', await draftCookie(apiKey, secure))
  }
}

/** A host for plain servers and scripts, which pass requests explicitly. */
export function requestHost(config: Config): ServerHost {
  // One request object per incoming request, so its state is shared by
  // every query it runs.
  const requests = new WeakMap<Request, HostRequest>()
  return {
    current() {
      const request = storage.getStore()
      if (!request) return undefined
      let current = requests.get(request)
      if (!current)
        requests.set(request, (current = new ServerRequest(config, request)))
      return current
    },
    forRequest(request) {
      return new ServerRequest(config, request)
    },
    async isBuild() {
      return process.env.ALINEA_BUILD === 'true'
    },
    isEdge() {
      return false
    }
  }
}
