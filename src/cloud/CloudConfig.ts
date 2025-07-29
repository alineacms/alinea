function createCloudConfig(baseUrl: string) {
  return {
    url: baseUrl,
    jwks: `${baseUrl}/.well-known/jwks.json`,
    setup: `${baseUrl}/setup`,
    handshake: `${baseUrl}/api/v1/handshake`,
    upload: `${baseUrl}/api/v1/upload`,
    logout: `${baseUrl}/api/v1/logout`,
    history: `${baseUrl}/api/v1/history`,
    drafts: `${baseUrl}/api/v1/draft`,

    tree: `${baseUrl}/api/v1/tree`,
    blobs: `${baseUrl}/api/v1/blobs`,
    write: `${baseUrl}/api/v1/write`,

    // Oauth2 endpoints
    auth: `${baseUrl}/auth`,
    token: `${baseUrl}/oauth/token`,
    revocation: `${baseUrl}/oauth/token/revoke`
  }
}

function createCloudUrl() {
  if (typeof process !== 'undefined') {
    if (process.env.ALINEA_CLOUD_URL) return process.env.ALINEA_CLOUD_URL
    if (process.env.ALINEA_CLOUD_DEBUG) return ''
  }
  return 'https://www.alinea.cloud'
}

export const cloudUrl = createCloudUrl()
export const cloudConfig = createCloudConfig(cloudUrl)
