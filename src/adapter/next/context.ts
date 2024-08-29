import {RequestContext} from 'alinea/backend'
import {generatedRelease} from 'alinea/backend/store/GeneratedRelease'

export const defaultContext: Promise<RequestContext> = generatedRelease.then(
  release => ({
    apiKey:
      process.env.NODE_ENV === 'development'
        ? 'dev'
        : process.env.ALINEA_API_KEY ?? release
  })
)
