import {CMSApi} from '../CMS.js'
import {Config} from '../Config.js'
import {DefaultDriver} from './DefaultDriver.js'

export interface NextApi extends CMSApi {
  previews(): JSX.Element
  backendHandler(request: Request): Promise<Response>
  previewHandler(request: Request): Promise<Response>
}

export function createNextCMS<Definition extends Config>(
  config: Definition
): Definition & NextApi {
  return new DefaultDriver(config) as any
}
