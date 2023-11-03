function createCloudConfig(baseUrl: string) {
  return {
    url: baseUrl,
    jwks: `${baseUrl}/.well-known/jwks.json`,
    setup: `${baseUrl}/setup`,
    auth: `${baseUrl}/auth`,
    handshake: `${baseUrl}/api/v1/handshake`,
    mutate: `${baseUrl}/api/v1/mutate`,
    upload: `${baseUrl}/api/v1/upload`,
    media: `${baseUrl}/api/v1/media`,
    logout: `${baseUrl}/api/v1/logout`,
    history: `${baseUrl}/api/v1/history`
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
