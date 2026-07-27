export interface AuthLoading {
  status: 'loading'
}

export interface AuthMissingHandler {
  status: 'missingHandler'
}

export interface AuthMissingApiKey {
  status: 'missingApiKey'
  setupUrl: string
}

export interface AuthRedirecting {
  status: 'redirecting'
}

export interface AuthError {
  status: 'error'
  error: Error
}

export interface Authenticated {
  status: 'authenticated'
}

export type AuthState =
  | AuthLoading
  | AuthMissingHandler
  | AuthMissingApiKey
  | AuthRedirecting
  | AuthError
  | Authenticated

export function appendReturnUrl(url: string): string {
  const {location} = window
  const from = encodeURIComponent(
    `${location.protocol}//${location.host}${location.pathname}`
  )
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}from=${from}`
}
