import {
  PasswordLessAuth,
  PasswordLessAuthOptions
} from 'alinea/auth/passwordless/PasswordLessAuth'
import type {Auth} from 'alinea/core/Auth'
import {PasswordLessLogin} from './passwordless/PasswordLessLogin.js'

export type PasswordLess = PasswordLessAuthOptions

export const passwordLess: Auth<PasswordLessAuthOptions> = {
  view: PasswordLessLogin,
  configure: options => new PasswordLessAuth(options)
}
