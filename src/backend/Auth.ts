import {HttpError} from 'alinea/core/HttpError.js'

export enum AuthAction {
  Status = 'status',
  Handshake = 'handshake',
  Login = 'login',
  Logout = 'logout'
}

export class AuthError extends HttpError {
  constructor(message: string, options?: ErrorOptions) {
    super(401, message, options)
  }
}

export class MissingCredentialsError extends AuthError {}
export class InvalidCredentialsError extends AuthError {}
