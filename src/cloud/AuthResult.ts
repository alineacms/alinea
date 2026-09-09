import type {BackendCapabilities} from '#/core/Connection.js'
import type {User} from '#/core/User.js'

export enum AuthResultType {
  Authenticated,
  UnAuthenticated,
  MissingApiKey,
  NeedsRefresh
}

export type AuthResult =
  | {
      type: AuthResultType.Authenticated
      user: User
      capabilities?: BackendCapabilities
    }
  | {type: AuthResultType.UnAuthenticated; redirect: string}
  | {type: AuthResultType.MissingApiKey; setupUrl: string}
  | {type: AuthResultType.NeedsRefresh}
