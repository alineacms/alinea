import {Response} from '@alinea/iso'
import {AuthAction} from 'alinea/backend/Auth'
import {OAuth2} from 'alinea/backend/api/OAuth2'
import {Config} from 'alinea/core/Config'
import type {
  AuthedContext,
  RemoteConnection,
  RequestContext,
  Revision
} from 'alinea/core/Connection'
import {
  type Draft,
  type DraftKey,
  formatDraftKey,
  parseDraftKey
} from 'alinea/core/Draft'
import type {CommitRequest} from 'alinea/core/db/CommitRequest'
import type {EntryRecord} from 'alinea/core/EntryRecord'
import {HttpError} from 'alinea/core/HttpError'
import {ShaMismatchError} from 'alinea/core/source/ShaMismatchError'
import {ReadonlyTree, type Tree} from 'alinea/core/source/Tree'
import {base64} from 'alinea/core/util/Encoding'
import {Workspace} from 'alinea/core/Workspace'
import pkg from '../../package.json'
import {AuthResultType} from './AuthResult.js'
import {cloudConfig} from './CloudConfig.js'

export class CloudRemote extends OAuth2 implements RemoteConnection {
  #context: RequestContext
  #config: Config

  constructor(context: RequestContext, config: Config) {
    const clientId = context.apiKey.split('_')[1]
    super(context, config, {
      clientId,
      clientSecret: context.apiKey,
      jwksUri: cloudConfig.jwks,
      tokenEndpoint: cloudConfig.token,
      authorizationEndpoint: cloudConfig.auth,
      revocationEndpoint: cloudConfig.revocation
    })
    this.#context = context
    this.#config = config
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const ctx = this.#context
    return parseOutcome<Tree | null>(
      fetch(
        cloudConfig.tree,
        json({
          method: 'POST',
          headers: bearer(ctx),
          body: JSON.stringify({
            contentDir: Config.contentDir(this.#config),
            sha
          })
        })
      )
    ).then(tree => {
      return tree ? new ReadonlyTree(tree) : undefined
    })
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const ctx = this.#context
    const response = await fetch(cloudConfig.blobs, {
      method: 'POST',
      body: JSON.stringify({shas}),
      headers: {
        ...bearer(ctx),
        'content-type': 'application/json',
        accept: 'multipart/form-data'
      }
    }).then(failOnHttpError)
    const form = await response.formData()
    for (const [key, value] of form.entries()) {
      if (value instanceof Blob) {
        const sha = key.slice(0, 40)
        const blob = new Uint8Array(await value.arrayBuffer())
        yield [sha, blob]
      }
    }
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    const ctx = this.#context
    return parseOutcome<{sha: string}>(
      fetch(
        cloudConfig.write,
        json({
          method: 'POST',
          headers: bearer(ctx),
          body: JSON.stringify({
            contentDir: Config.contentDir(this.#config),
            ...request
          })
        })
      )
    ).catch<{sha: string}>(error => {
      if (error instanceof HttpError && error.code === 409) {
        const actual = 'actualSha' in error && (error.actualSha as string)
        const expected = 'expectedSha' in error && (error.expectedSha as string)
        if (actual && expected) throw new ShaMismatchError(actual, expected)
      }
      throw error
    })
  }

  async authenticate(request: Request) {
    const ctx = this.#context
    const config = this.#config
    const url = new URL(request.url)
    const action = url.searchParams.get('auth')
    switch (action) {
      case AuthAction.Status: {
        const token = ctx.apiKey?.split('_')[1]
        if (!token)
          return Response.json({
            type: AuthResultType.MissingApiKey,
            setupUrl: cloudConfig.setup
          })
        return super.authenticate(request)
      }
      // The cloud server will request a handshake confirmation on this route
      case AuthAction.Handshake: {
        const handShakeId = url.searchParams.get('handshake_id')
        if (!handShakeId)
          throw new HttpError(
            400,
            'Provide a valid handshake id to initiate handshake'
          )
        const body: any = {
          handshake_id: handShakeId,
          status: {
            version: pkg.version,
            roles: [
              {
                key: 'editor',
                label: 'Editor',
                description: 'Can view and edit all pages'
              }
            ],
            enableOAuth2: true,
            sourceDirectories: Object.values(config.workspaces)
              .flatMap(workspace => {
                const {source, mediaDir} = Workspace.data(workspace)
                return [source, mediaDir]
              })
              .filter(Boolean)
          }
        }
        // We submit the handshake id, our status and authorize using the
        // private key
        const res = await fetch(cloudConfig.handshake, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            ...bearer(ctx)
          }
        }).catch(e => {
          throw new HttpError(500, `Could not reach handshake api: ${e}`)
        })
        if (res.status !== 200)
          throw new HttpError(
            res.status,
            `Handshake failed: ${await res.text()}`
          )
        return new Response('alinea cloud handshake')
      }
      default:
        return super.authenticate(request)
    }
  }

  prepareUpload(file: string) {
    const ctx = this.#context
    return parseOutcome<{
      entryId: string
      location: string
      previewUrl: string
      provider: string
      upload: {method?: string; url: string}
    }>(
      fetch(
        cloudConfig.upload,
        json({
          method: 'POST',
          headers: bearer(ctx),
          body: JSON.stringify({filename: file})
        })
      )
    ).then(({upload, ...rest}) => {
      return {
        ...rest,
        method: upload.method,
        url: upload.url
      }
    })
  }

  async getDraft(draftKey: DraftKey): Promise<Draft | undefined> {
    const ctx = this.#context
    if (!validApiKey(ctx.apiKey)) return
    const {entryId, locale} = parseDraftKey(draftKey)
    type CloudDraft = {fileHash: string; update: string; commitHash: string}
    const data = await parseOutcome<CloudDraft | null>(
      fetch(`${cloudConfig.drafts}/${draftKey}`, json({headers: bearer(ctx)}))
    )
    return data?.update
      ? {
          entryId,
          locale,
          fileHash: data.fileHash,
          draft: base64.parse(data.update)
        }
      : undefined
  }

  async storeDraft(draft: Draft): Promise<void> {
    const ctx = this.#context
    const key = formatDraftKey({id: draft.entryId, locale: draft.locale})
    return parseOutcome(
      fetch(
        `${cloudConfig.drafts}/${key}`,
        json({
          method: 'PUT',
          headers: bearer(ctx),
          body: JSON.stringify({
            fileHash: draft.fileHash,
            update: base64.stringify(draft.draft)
          })
        })
      )
    )
  }

  revisions(file: string): Promise<Array<Revision>> {
    const ctx = this.#context
    return parseOutcome(
      fetch(
        `${cloudConfig.history}?${new URLSearchParams({file})}`,
        json({headers: bearer(ctx)})
      )
    )
  }

  revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    const ctx = this.#context
    return parseOutcome(
      fetch(
        `${cloudConfig.history}?${new URLSearchParams({file, ref: revisionId})}`,
        json({headers: bearer(ctx)})
      )
    )
  }
}

function validApiKey(apiKey: string | undefined): boolean {
  return Boolean(apiKey?.startsWith('alineapk'))
}

function bearer(ctx: AuthedContext | RequestContext) {
  return {authorization: `Bearer ${'token' in ctx ? ctx.token : ctx.apiKey}`}
}

function json(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('content-type', 'application/json')
  headers.set('accept', 'application/json')
  return {...init, headers}
}

async function failOnHttpError(response: Response): Promise<Response> {
  if (!response.ok) throw new HttpError(response.status, await response.text())
  return response
}

async function parseOutcome<T>(expected: Promise<Response>): Promise<T> {
  const response = await expected
  const contentType = response.headers.get('content-type')
  const isJson = contentType?.includes('application/json')
  if (!response.ok && !isJson) {
    const message = await response.text()
    throw new HttpError(response.status, message)
  }
  const output = await response.json()
  if (output.success) {
    return output.data as T
  }
  if (output.error) {
    if (typeof output.error === 'object') {
      const error = new HttpError(response.status, 'Unexpected error')
      Object.assign(error, output.error)
      throw error
    }
    throw new HttpError(response.status, output.error)
  }
  throw new HttpError(
    response.status,
    `Unexpected response: ${JSON.stringify(output)}`
  )
}
