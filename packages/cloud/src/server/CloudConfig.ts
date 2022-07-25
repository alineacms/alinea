const baseUrl = 'https://www.alinea.cloud'

export const cloudConfig = {
  url: baseUrl,
  jwks: `${baseUrl}/.well-known/jwks.json`,
  auth: `${baseUrl}/auth`,
  handshake: `${baseUrl}/api/v1/handshake`,
  publish: `${baseUrl}/api/v1/publish`,
  draft: `${baseUrl}/api/v1/draft`,
  media: `${baseUrl}/api/v1/media`
}
