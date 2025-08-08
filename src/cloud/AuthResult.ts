import type {User} from 'alinea/core/User'

export enum AuthResultType {
  Authenticated,
  UnAuthenticated,
  MissingApiKey,
  NeedsRefresh
}

export type AuthResult =
  | {type: AuthResultType.Authenticated; user: User}
  | {type: AuthResultType.UnAuthenticated; redirect: string}
  | {type: AuthResultType.MissingApiKey; setupUrl: string}
  | {type: AuthResultType.NeedsRefresh}
