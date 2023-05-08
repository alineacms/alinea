import {fetch} from '@alinea/iso'
import {Drafts} from 'alinea/backend/Drafts'
import {Connection} from 'alinea/core'
import {createError} from 'alinea/core/ErrorWithCode'
import {base64, base64url} from 'alinea/core/util/Encoding'

async function failOnHttpError(res: Response): Promise<Response> {
  if (res.status >= 400) throw createError(res.status, await res.text())
  return res
}

function json<T>(res: Response): Promise<T> {
  return res.json()
}

export type DevDraftsOptions = {
  serverLocation: string
}

export class DevDrafts implements Drafts {
  constructor(public options: DevDraftsOptions) {}

  // We never need to mutate from the preview side
  async update(params: Connection.UpdateParams): Promise<Drafts.Update> {
    return params
  }
  async delete({ids}: Connection.DeleteMultipleParams): Promise<void> {}

  // Forward draft requests to the running alinea server
  get(
    {id, stateVector}: Connection.EntryParams,
    ctx: Connection.Context
  ): Promise<Uint8Array | undefined> {
    const {serverLocation} = this.options
    const params = stateVector
      ? '?' +
        new URLSearchParams({stateVector: base64url.stringify(stateVector)})
      : ''
    const url = `${serverLocation}${Connection.routes.base}/~draft/${id}${params}`
    return fetch(url, {
      headers: {accept: 'application/json'}
    }).then(res => {
      if (res.status === 404) return undefined
      return failOnHttpError(res)
        .then(res => res.arrayBuffer())
        .then(buffer => new Uint8Array(buffer))
    })
  }

  async *updates({}, ctx: Connection.Context): AsyncGenerator<Drafts.Update> {
    const {serverLocation} = this.options
    const url = `${serverLocation}${Connection.routes.base}/~draft`
    const updates = await fetch(url, {
      headers: {accept: 'application/json'}
    })
      .then(failOnHttpError)
      .then<
        Array<{
          id: string
          update: string
        }>
      >(json)

    for (const update of updates) {
      yield {
        id: update.id,
        update: base64.parse(update.update)
      }
    }
  }
}
