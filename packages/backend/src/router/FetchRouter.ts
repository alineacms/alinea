import {Entry} from '@alinea/core/Entry'
import {Hub} from '@alinea/core/Hub'
import {Cursor, CursorData} from '@alinea/store'
import {decode} from 'base64-arraybuffer'
import {router} from './Router'

export function createFetchRouter(hub: Hub, url: string) {
  const matcher = router.startAt(Hub.routes.base)
  return router(
    matcher
      .get(Hub.routes.entry(':id'))
      .map(({url, params}) => {
        const id = params.id as string
        const svParam = url.searchParams.get('stateVector')!
        const stateVector =
          typeof svParam === 'string'
            ? new Uint8Array(decode(svParam))
            : undefined
        return hub.entry(id, stateVector)
      })
      .map(router.jsonResponse),

    matcher
      .post(Hub.routes.query())
      .map(router.parseJson)
      .map(({url, body}) => {
        const fromSource = url.searchParams.has('source')
        return hub.query(new Cursor(body as CursorData), {source: fromSource})
      })
      .map(router.jsonResponse),

    matcher
      .get(Hub.routes.drafts())
      .map(({url}) => {
        const workspace = url.searchParams.get('workspace')
        if (!workspace) return undefined
        return hub.listDrafts(workspace)
      })
      .map(router.jsonResponse),

    matcher
      .put(Hub.routes.draft(':id'))
      .map(router.parseBuffer)
      .map(({params, body}) => {
        const id = params.id as string
        return hub.updateDraft(id, new Uint8Array(body))
      })
      .map(router.jsonResponse),

    matcher
      .delete(Hub.routes.draft(':id'))
      .map(({params}) => {
        const id = params.id as string
        return hub.deleteDraft(id)
      })
      .map(router.jsonResponse),

    matcher
      .post(Hub.routes.publish())
      .map(router.parseJson)
      .map(({body}) => {
        return hub.publishEntries(body as Array<Entry>)
      })
      .map(router.jsonResponse),

    matcher
      .post(Hub.routes.upload())
      .map(router.parseFormData)
      .map(async ({body}) => {
        const workspace = String(body.get('workspace'))
        const root = String(body.get('root'))
        return hub.uploadFile(workspace, root, {
          buffer: await (body.get('buffer') as File).arrayBuffer(),
          path: String(body.get('path')),
          preview: String(body.get('preview')),
          averageColor: String(body.get('averageColor')),
          blurHash: String(body.get('blurHash')),
          width: Number(body.get('width')),
          height: Number(body.get('height'))
        })
      })
      .map(router.jsonResponse)
  ).recover(router.reportError)
}
