import {generatedRelease} from 'alinea/backend/store/GeneratedRelease'

export const defaultContext = {
  apiKey: process.env.ALINEA_API_KEY ?? generatedRelease
}
