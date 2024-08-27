import {generatedRelease} from 'alinea/backend/store/GeneratedRelease'

export const defaultContext = {
  apiKey:
    process.env.NODE_ENV === 'development'
      ? 'dev'
      : process.env.ALINEA_API_KEY ?? generatedRelease
}
