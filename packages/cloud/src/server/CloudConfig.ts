const baseUrl = 'http://localhost:3000'

export const cloudConfig = {
  url: baseUrl,
  jwks: `https://www.alinea.cloud/.well-known/jwks.json`,
  auth: `${baseUrl}/auth`,
  handshake: `${baseUrl}/api/v1/handshake`,
  publish: `${baseUrl}/api/v1/publish`,
  draft: `${baseUrl}/api/v1/draft`,
  media: `${baseUrl}/api/v1/media`,
  logout: `${baseUrl}/api/v1/logout`
}
