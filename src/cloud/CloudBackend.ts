import {Response} from '@alinea/iso'
import {
  Auth,
  AuthedContext,
  Backend,
  Drafts,
  History,
  Media,
  Pending,
  RequestContext,
  Target
} from 'alinea/backend/Backend'
import {ChangeSet} from 'alinea/backend/data/ChangeSet'
import {router} from 'alinea/backend/router/Router'
import {Config} from 'alinea/core/Config'
import {HttpError} from 'alinea/core/HttpError'
import {outcome, Outcome, OutcomeJSON} from 'alinea/core/Outcome'
import {User} from 'alinea/core/User'
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

const COOKIE_NAME = 'alinea.cloud'

export enum AuthAction {
  Status = 'status',
  Handshake = 'handshake',
  Login = 'login',
  Logout = 'logout'
}

export function cloudBackend(config: Config): Backend {
  const auth: Auth = {
    async authenticate(ctx, request) {
      const url = new URL(request.url)
      const action = url.searchParams.get('auth')
      const dashboardPath =
        config.dashboardFile ?? config.dashboard?.dashboardUrl
      const dashboardUrl = new URL(dashboardPath ?? '/admin.html', url)
      switch (action) {
        // We start by asking our backend whether we have:
        // - a logged in user => return the user so we can create a session
        // - no user, but a valid api key => we can redirect to cloud login
        // - no api key => display a message to setup backend
        case AuthAction.Status: {
          const token = ctx.apiKey && ctx.apiKey.split('_')[1]
          if (!token)
            return Response.json({
              type: AuthResultType.MissingApiKey,
              setupUrl: cloudConfig.setup
            })
          const [authed, err] = await outcome(this.verify(ctx, request))
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
            const {token} = await this.verify(ctx, request)
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
    },
    async verify(ctx, request) {
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
  }
  const target: Target = {
    async mutate(ctx, params) {
      return parseOutcome(
        fetch(
          cloudConfig.mutate,
          json({
            method: 'POST',
            headers: bearer(ctx),
            body: JSON.stringify(params)
          })
        )
      )
    }
  }
  const media: Media = {
    upload(ctx, file) {
      return parseOutcome(
        fetch(
          cloudConfig.upload,
          json({
            method: 'POST',
            headers: bearer(ctx),
            body: JSON.stringify({filename: file})
          })
        )
      )
    }
  }
  const drafts: Drafts = {
    async get(ctx, entryId) {
      if (!validApiKey(ctx.apiKey)) return
      type CloudDraft = {fileHash: string; update: string; commitHash: string}
      const data = await parseOutcome<CloudDraft | null>(
        fetch(cloudConfig.drafts + '/' + entryId, json({headers: bearer(ctx)}))
      )
      return data?.update
        ? {
            entryId,
            commitHash: data.commitHash,
            fileHash: data.fileHash,
            draft: base64.parse(data.update)
          }
        : undefined
    },
    store(ctx, draft) {
      return parseOutcome(
        fetch(
          cloudConfig.drafts + '/' + draft.entryId,
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
  }
  const history: History = {
    async list(ctx, file) {
      return parseOutcome(
        fetch(
          cloudConfig.history + '?' + new URLSearchParams({file}),
          json({headers: bearer(ctx)})
        )
      )
    },
    async revision(ctx, file, ref) {
      return parseOutcome(
        fetch(
          cloudConfig.history + '?' + new URLSearchParams({file, ref}),
          json({headers: bearer(ctx)})
        )
      )
    }
  }
  const pending: Pending = {
    async since(ctx, commitHash) {
      if (!validApiKey(ctx.apiKey)) return
      return parseOutcome<Array<{commitHashTo: string; mutations: ChangeSet}>>(
        fetch(
          cloudConfig.pending + '?' + new URLSearchParams({since: commitHash}),
          json({headers: bearer(ctx)})
        )
      ).then(pending => {
        if (pending.length === 0) return undefined
        return {
          toCommitHash: pending[pending.length - 1].commitHashTo,
          mutations: pending.flatMap(mutate =>
            mutate.mutations.flatMap(m => m.meta)
          )
        }
      })
    }
  }
  return {
    auth,
    target,
    media,
    drafts,
    history,
    pending
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

async function failOnHttpError(res: Response): Promise<Response> {
  if (res.status >= 400) throw new HttpError(res.status, await res.text())
  return res
}

function parseJson<T>(res: Response): Promise<T> {
  return res.json()
}

function parseOutcome<T>(res: Promise<Response>): Promise<T> {
  return res
    .then(failOnHttpError)
    .then<OutcomeJSON<T>>(parseJson)
    .then<Outcome<T>>(Outcome.fromJSON)
    .then(Outcome.unpack)
}
