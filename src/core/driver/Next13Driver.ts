import {Client} from 'alinea/client'
import {createCMS} from '../CMS.js'
import {Config} from '../Config.js'
// @ts-ignore
import {draftMode} from 'next/headers'

export function createNextCMS<Definition extends Config>(config: Definition) {
  return createCMS(config, {
    establishConnection() {
      const {isEnbabled: isDraft} = draftMode()
      const devPort = process.env.ALINEA_PORT || 4500
      const isDevelopment = process.env.NODE_ENV === 'development'
      // Todo: pass port in env when booting next
      if (isDevelopment)
        return new Client(config, `http://127.0.0.1:${devPort}`)
      throw new Error(`No CMS connection available`)
    }
  })
}
