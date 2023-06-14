import {CMSApi, DefaultCMS} from '../CMS.js'
import {Config} from '../Config.js'

export interface NextApi extends CMSApi {
  previews(): JSX.Element
  backendHandler(request: Request): Promise<Response>
  previewHandler(request: Request): Promise<Response>
}

export function createNextCMS<Definition extends Config>(
  config: Definition
): Definition & NextApi {
  return new DefaultCMS(config) as any
}
