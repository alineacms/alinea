import {Config} from '../Config.js'
import {Connection} from '../Connection.js'
import {Driver} from '../Driver.js'

export class DefaultDriver implements Driver {
  constructor(protected config: Config) {}

  establishConnection(): Connection {
    // const isBrowser = typeof window !== 'undefined'
    // if (isBrowser) return new Client(this.config)
    throw new Error('Method not implemented.')
  }
}
