import {
  PasswordLessAuth,
  PasswordLessAuthOptions
} from 'alinea/auth/passwordless/PasswordLessAuth'
import {Auth} from 'alinea/core'
import {PasswordLessLogin} from './passwordLess/PasswordLessLogin.js'

export type PasswordLess = PasswordLessAuthOptions

export const passwordLess: Auth<PasswordLessAuthOptions> = {
  view: PasswordLessLogin,
  configure: options => new PasswordLessAuth(options)
}
