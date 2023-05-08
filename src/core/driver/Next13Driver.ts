import {createCMS} from '../CMS.js'
import {Config} from '../Config.js'
// @ts-ignore

export function createNextCMS<Definition extends Config>(config: Definition) {
  return createCMS(config, {
    establishConnection() {
      throw new Error('Method not implemented.')
    }
  })
}
