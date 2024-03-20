import {MediaExplorer} from 'alinea/dashboard/view/MediaExplorer'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {PageSeed} from '../Page.js'
import {root} from '../Root.js'
import {
  MediaRoot,
  createMediaRoot as createMediaRootConfig
} from './MediaRoot.js'

export function createMediaRoot<Children extends Record<string, PageSeed>>(
  children: Children = {} as Children
) {
  return root('Media', {
    icon: IcRoundPermMedia,
    contains: ['MediaLibrary'],
    view: MediaExplorer,
    isMediaRoot: true,
    entries: {
      ...createMediaRootConfig(children)
    }
  }) as any as MediaRoot<Children>
}
