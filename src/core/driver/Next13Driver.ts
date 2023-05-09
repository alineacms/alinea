import {createCMS} from '../CMS.js'
import {Client} from '../Client.js'
import {Config} from '../Config.js'
import {DefaultDriver} from './DefaultDriver.js'

class Next13Driver extends DefaultDriver {
  async establishConnection() {
    // @ts-ignore
    const {draftMode} = await import('next/headers')
    const {isEnabled: isDraft} = draftMode()
    const devPort = process.env.ALINEA_PORT || 4500
    const isDevelopment = process.env.NODE_ENV === 'development'
    // Todo: pass port in env when booting next
    if (isDevelopment)
      return new Client(this.config, `http://127.0.0.1:${devPort}`)
    throw new Error(`No CMS connection available`)
  }
}

export function createNextCMS<Definition extends Config>(config: Definition) {
  return createCMS(config, new Next13Driver(config))
}
