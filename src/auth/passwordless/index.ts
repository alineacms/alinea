import {
  PasswordLessAuth,
  PasswordLessAuthOptions
} from 'alinea/auth/passwordless/server/PasswordLessAuth'
import {Auth} from 'alinea/core'
import {PasswordLessLogin} from './PasswordLessLogin'

export type PasswordLess = PasswordLessAuthOptions

export const passwordLess: Auth<PasswordLessAuthOptions> = {
  view: PasswordLessLogin,
  configure: options => new PasswordLessAuth(options)
}
