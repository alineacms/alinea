import {Backend} from '@alinea/backend/Backend'
import {FileData} from '@alinea/backend/data/FileData'
import {FileDrafts} from '@alinea/backend/drafts/FileDrafts'
import {JsonLoader} from '@alinea/backend/loader/JsonLoader'
import {router} from '@alinea/backend/router/Router'
import {JWTPreviews} from '@alinea/backend/util/JWTPreviews'
import {accumulate, Config, Hub, outcome, Workspaces} from '@alinea/core'
import {base64, base64url} from '@alinea/core/util/Encoding'
import {Response} from '@alinea/iso'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface ServeBackendOptions<T extends Workspaces> {
  cwd?: string
  port?: number
  config: Config<T>
  store: SqliteStore
}

export class ServeBackend<
  T extends Workspaces = Workspaces
> extends Backend<T> {
  reload: (config: Config<T>) => void
  constructor({
    cwd = process.cwd(),
    port = 4500,
    config,
    store
  }: ServeBackendOptions<T>) {
    const dashboardUrl = `http://localhost:${port}`
    const outDir = path.join(cwd, '.alinea')
    const data = new FileData({
      config,
      fs,
      loader: JsonLoader,
      rootDir: cwd
    })
    const drafts = new FileDrafts({
      fs,
      dir: path.join(outDir, '.drafts')
    })
    const options = {
      dashboardUrl,
      createStore: async () => store,
      config,
      drafts: drafts,
      media: data,
      target: data,
      previews: new JWTPreviews('@alinea/backend/devserver'),
      applyPublish: false
    }
    super(options)
    this.reload = config => {
      data.options.config = config
      this.options.config = config
    }
    const api = this.handle
    const matcher = router.matcher()
    this.handle = router(
      matcher
        .get(Hub.routes.base + '/~draft')
        .map(async () => {
          const updates = await accumulate(drafts.updates())
          return updates.map(u => {
            return {id: u.id, update: base64.stringify(u.update)}
          })
        })
        .map(router.jsonResponse),
      matcher
        .get(Hub.routes.base + '/~draft/:id')
        .map(async ({params, url}) => {
          const id = params.id as string
          const svParam = url.searchParams.get('stateVector')
          const stateVector = svParam ? base64url.parse(svParam) : undefined
          const update = await drafts.get({id, stateVector})
          if (!update) return new Response('Not found', {status: 404})
          return new Response(await drafts.get({id, stateVector}), {
            headers: {'content-type': 'application/octet-stream'}
          })
        }),
      matcher
        .get(Hub.routes.base + '/~publish')
        .map(router.parseJson)
        .map(({body}) => {
          return outcome(data.publish({changes: body as any}))
        })
        .map(router.jsonResponse),
      matcher
        .post(Hub.routes.base + '/~media')
        .map(router.parseBuffer)
        .map(({request, body}) => {
          const fileLocation = request.headers.get('x-file-location') as string
          return outcome(data.upload({fileLocation, buffer: body}))
        })
        .map(router.jsonResponse),
      matcher.get(Hub.routes.base + '/~media').map(({}) => {
        return new Response('Not implemented', {status: 500})
      }),
      api
    ).recover(router.reportError).handle
  }

  reloadPreviewStore() {
    return this.preview.reload()
  }
}
