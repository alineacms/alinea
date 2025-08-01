import {HttpError} from 'alinea/core/HttpError'

export enum AuthAction {
  Status = 'status',
  Handshake = 'handshake',
  Login = 'login',
  Logout = 'logout'
}

export class AuthError extends HttpError {
  name = 'AuthError'
  constructor(message: string, options?: ErrorOptions) {
    super(401, message, options)
  }
}

export class MissingCredentialsError extends AuthError {
  name = 'MissingCredentialsError'
}
export class InvalidCredentialsError extends AuthError {
  name = 'InvalidCredentialsError'
}
