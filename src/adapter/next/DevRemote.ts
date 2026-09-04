import {composeBackend} from '#/backend/api/CreateBackend.js'
import {MissingCredentialsError} from '#/backend/Auth.js'
import {AuthResultType} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import type {RemoteConnection, RequestContext} from '#/core/Connection.js'
import type {Config} from '#/core/Config.js'

export function createDevRemote(
  context: RequestContext,
  config: Config
): RemoteConnection {
  const client = new Client({
    config,
    url: context.handlerUrl.href,
    applyAuth: context.applyAuth
  })
  const auth = {
    async authenticate(): Promise<Response> {
      return Response.json({type: AuthResultType.Authenticated})
    },
    async verify() {
      const user = await client.user()
      if (!user)
        throw new MissingCredentialsError(
          'Missing forwarded development authentication'
        )
      return {...context, user, token: 'dev'}
    }
  }
  const connection: Partial<RemoteConnection> = {
    getTreeIfDifferent: sha => client.getTreeIfDifferent(sha),
    getBlobs: (shas, options) => client.getBlobs(shas, options),
    write: request => client.write(request),
    enrichUser: async input => input
  }
  return composeBackend(connection, auth)
}
