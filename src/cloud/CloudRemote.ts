import {Response} from '@alinea/iso'
import {AuthAction} from 'alinea/backend/Auth'
import {router} from 'alinea/backend/router/Router'
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
import {Outcome, outcome} from 'alinea/core/Outcome'
import {ShaMismatchError} from 'alinea/core/source/ShaMismatchError'
import {ReadonlyTree, type Tree} from 'alinea/core/source/Tree'
import type {User} from 'alinea/core/User'
import {base64} from 'alinea/core/util/Encoding'
import {verify} from 'alinea/core/util/JWT'
import {Workspace} from 'alinea/core/Workspace'
import PLazy from 'p-lazy'
import pkg from '../../package.json'
import {AuthResultType} from './AuthResult.js'
import {cloudConfig} from './CloudConfig.js'

type JWKS = {keys: Array<JsonWebKey>}

class RemoteUnavailableError extends Error {}

let publicKey = PLazy.from(async function loadPublicKey(
  retry = 0
): Promise<JsonWebKey> {
  try {
    const res = await fetch(cloudConfig.jwks)
    if (res.status !== 200) throw new HttpError(res.status, await res.text())
    const result: JWKS = await res.json()
    const jwks = result
    const key = jwks.keys[0]
    if (!key) throw new HttpError(500, 'No signature key found')
    return key
  } catch (error) {
    if (retry < 3) return loadPublicKey(retry + 1)
    publicKey = PLazy.from(loadPublicKey)
    throw new RemoteUnavailableError('Remote unavailable', {cause: error})
  }
})

export const COOKIE_NAME = 'alinea.auth'

export class CloudRemote implements RemoteConnection {
  #context: RequestContext
  #config: Config

  constructor(context: RequestContext, config: Config) {
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
    let dashboardPath = config.dashboardFile ?? '/admin.html'
    if (!dashboardPath.startsWith('/')) dashboardPath = `/${dashboardPath}`
    const dashboardUrl = new URL(dashboardPath, url)
    switch (action) {
      // We start by asking our backend whether we have:
      // - a logged in user => return the user so we can create a session
      // - no user, but a valid api key => we can redirect to cloud login
      // - no api key => display a message to setup backend
      case AuthAction.Status: {
        const token = ctx.apiKey?.split('_')[1]
        if (!token)
          return Response.json({
            type: AuthResultType.MissingApiKey,
            setupUrl: cloudConfig.setup
          })
        const [authed, err] = await outcome(this.verify(request))
        if (authed)
          return Response.json({
            type: AuthResultType.Authenticated,
            user: authed.user
          })
        return Response.json({
          type: AuthResultType.UnAuthenticated,
          redirect: `${cloudConfig.auth}?token=${token}`
        })
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

      // If the user followed through to the cloud login page it should
      // redirect us here with a token
      case AuthAction.Login: {
        const token: string | null = url.searchParams.get('token')
        if (!token) throw new HttpError(400, 'Token required')
        const user = await verify<User>(token, await publicKey)
        // Store the token in a cookie and redirect to the dashboard
        // Todo: add expires and max-age based on token expiration
        return router.redirect(dashboardUrl.href, {
          status: 302,
          headers: {
            'set-cookie': router.cookie({
              name: COOKIE_NAME,
              value: token,
              domain: dashboardUrl.hostname,
              path: '/',
              secure: dashboardUrl.protocol === 'https:',
              httpOnly: true,
              sameSite: 'strict'
            })
          }
        })
      }

      // The logout route unsets our cookies
      case AuthAction.Logout: {
        try {
          const {token} = await this.verify(request)
          if (token) {
            await fetch(cloudConfig.logout, {
              method: 'POST',
              headers: {authorization: `Bearer ${token}`}
            })
          }
        } catch (e) {
          console.error(e)
        }

        return router.redirect(dashboardUrl.href, {
          status: 302,
          headers: {
            'set-cookie': router.cookie({
              name: COOKIE_NAME,
              value: '',
              domain: dashboardUrl.hostname,
              path: '/',
              secure: dashboardUrl.protocol === 'https:',
              httpOnly: true,
              sameSite: 'strict',
              expires: new Date(0)
            })
          }
        })
      }
      default:
        return new Response('Bad request', {status: 400})
    }
  }

  async verify(request: Request) {
    const ctx = this.#context
    const cookies = request.headers.get('cookie')
    if (!cookies) throw new HttpError(401, 'Unauthorized - no cookies')
    const prefix = `${COOKIE_NAME}=`
    const token = cookies
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(prefix))
    if (!token) throw new HttpError(401, `Unauthorized - no ${COOKIE_NAME}`)
    const authToken = token.slice(prefix.length)
    return {
      ...ctx,
      token: authToken,
      user: await verify<User>(authToken, await publicKey)
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
    return output.value as T
  }
  if (output.error) {
    throw new HttpError(response.status, output.error)
  }
  throw new HttpError(
    response.status,
    `Unexpected response: ${JSON.stringify(output)}`
  )
}
