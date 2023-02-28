import {fetch} from '@alinea/iso'
import {Data} from 'alinea/backend/Data'
import {createError} from 'alinea/core/ErrorWithCode'
import {Hub} from 'alinea/core/Hub'
import {Outcome, OutcomeJSON} from 'alinea/core/Outcome'

async function failOnHttpError(res: Response): Promise<Response> {
  if (res.status >= 400) throw createError(res.status, await res.text())
  return res
}

function json<T>(res: Response): Promise<T> {
  return res.json()
}

export interface DevDataOptions {
  serverLocation: string
}

export class DevData implements Data.Media, Data.Target {
  canRename = true
  constructor(public options: DevDataOptions) {}

  protected url(endPoint: string) {
    const {serverLocation} = this.options
    return serverLocation + Hub.routes.base + endPoint
  }

  publish({changes}: Hub.ChangesParams) {
    return fetch(this.url('/~publish'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(changes)
    })
      .then(failOnHttpError)
      .then<OutcomeJSON<void>>(json)
      .then<Outcome<void>>(Outcome.fromJSON)
      .then(Outcome.unpack)
  }

  async upload({fileLocation, buffer}: Hub.MediaUploadParams): Promise<string> {
    return fetch(this.url('/~media'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/octet-stream',
        'x-file-location': fileLocation
      },
      body: buffer
    })
      .then(failOnHttpError)
      .then<OutcomeJSON<string>>(json)
      .then<Outcome<string>>(Outcome.fromJSON)
      .then(Outcome.unpack)
  }

  async download({location}: Hub.DownloadParams): Promise<Hub.Download> {
    return fetch(this.url('/~media') + '?' + new URLSearchParams({location}))
      .then(failOnHttpError)
      .then(async res => ({type: 'buffer', buffer: await res.arrayBuffer()}))
  }
}
