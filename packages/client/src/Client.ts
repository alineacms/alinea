import {Entry, Future, Hub, Media, Outcome, Schema} from '@alinea/core'
import fetch from 'isomorphic-fetch'

async function toFuture<T = void>(res: Response): Future<T> {
  return Outcome.fromJSON(await res.json())
}

export class Client implements Hub {
  constructor(
    public schema: Schema,
    protected url: string,
    protected applyAuth: (
      request?: RequestInit
    ) => RequestInit | undefined = v => v,
    protected unauthorized: () => void = () => {}
  ) {}

  entry(id: string, stateVector?: Uint8Array): Future<Entry.Detail | null> {
    return this.fetchJson(Hub.routes.entry(id, stateVector), {
      method: 'GET'
    }).then<Outcome<Entry.Detail | null>>(toFuture)
  }

  list(parentId?: string): Future<Array<Entry.Summary>> {
    return this.fetchJson(Hub.routes.list(parentId), {
      method: 'GET'
    }).then<Outcome<Array<Entry.Summary>>>(toFuture)
  }

  updateDraft(id: string, update: Uint8Array): Future {
    return this.fetch(Hub.routes.draft(id), {
      method: 'PUT',
      headers: {'content-type': 'application/octet-stream'},
      body: update
    }).then(toFuture)
  }

  deleteDraft(id: string): Future {
    return this.fetch(Hub.routes.draft(id), {
      method: 'DELETE'
    }).then(toFuture)
  }

  publishEntries(entries: Array<Entry>): Future {
    return this.fetchJson(Hub.routes.publish(), {
      method: 'POST',
      body: JSON.stringify(entries)
    }).then(toFuture)
  }

  uploadFile(file: Hub.Upload): Future<Media.File> {
    return this.fetch(Hub.routes.upload(), {
      method: 'POST',
      body: file.buffer,
      headers: {
        'content-type': 'application/octet-stream',
        'x-file-name': file.path
      }
    }).then<Outcome<Media.File>>(toFuture)
  }

  listFiles(location?: string): Future<Array<Hub.DirEntry>> {
    return this.fetch(Hub.routes.files(location), {
      method: 'GET'
    }).then<Outcome<Array<Hub.DirEntry>>>(toFuture)
  }

  protected async fetch(endpoint: string, init?: RequestInit) {
    const response = await fetch(this.url + endpoint, this.applyAuth(init))
    if (response.status === 401) this.unauthorized()
    return response
  }

  protected fetchJson(endpoint: string, init?: RequestInit) {
    return this.fetch(endpoint, {
      ...init,
      headers: {
        ...init?.headers,
        'content-type': 'application/json',
        accept: 'application/json'
      }
    })
  }
}
