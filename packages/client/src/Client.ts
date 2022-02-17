import {
  Config,
  Entry,
  Future,
  Hub,
  Media,
  Outcome,
  Workspaces
} from '@alinea/core'
import {Cursor} from '@alinea/store'
import fetch from 'isomorphic-fetch'

async function toFuture<T = void>(res: Response): Future<T> {
  return Outcome.fromJSON<T>(await res.json())
}

export class Client<T extends Workspaces> implements Hub<T> {
  constructor(
    public config: Config<T>,
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

  list<K extends keyof T>(
    workspace: K,
    root: keyof T[K]['roots'],
    parentId?: string
  ): Future<Array<Entry.Summary>> {
    return this.fetchJson(
      Hub.routes.list(workspace as string, root as string, parentId),
      {
        method: 'GET'
      }
    ).then<Outcome<Array<Entry.Summary>>>(toFuture)
  }

  query<T>(cursor: Cursor<T>): Future<Array<T>> {
    return this.fetchJson(Hub.routes.query(), {
      method: 'POST',
      body: JSON.stringify(cursor.toJSON())
    }).then<Outcome<Array<T>>>(toFuture)
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

  uploadFile<K extends keyof T>(
    workspace: K,
    root: keyof T[K]['roots'],
    file: Hub.Upload
  ): Future<Media.File> {
    const form = new FormData()
    if (file.preview) form.append('preview', file.preview)
    if (file.color) form.append('color', file.color)
    form.append('buffer', new Blob([file.buffer]))
    form.append('workspace', workspace as string)
    form.append('root', root as string)
    form.append('path', file.path)
    return this.fetch(Hub.routes.upload(), {
      method: 'POST',
      body: form
    }).then<Outcome<Media.File>>(toFuture)
  }

  listFiles(location?: string): Future<Array<Hub.DirEntry>> {
    return this.fetch(Hub.routes.files(location), {
      method: 'GET'
    }).then<Outcome<Array<Hub.DirEntry>>>(toFuture)
  }

  protected fetch(endpoint: string, init?: RequestInit) {
    const controller = new AbortController()
    const signal = controller.signal
    const promise = fetch(this.url + endpoint, {
      ...this.applyAuth(init),
      signal
    }).then(res => {
      if (res.status === 401) this.unauthorized()
      return res
    })
    ;(promise as any).cancel = () => controller.abort()
    return promise
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
