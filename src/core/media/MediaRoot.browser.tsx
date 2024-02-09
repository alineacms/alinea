import {MediaExplorer} from 'alinea/dashboard/view/MediaExplorer'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {PageSeed} from '../Page.js'
import {root} from '../Root.js'
import {
  MediaRoot,
  createMediaRoot as createMediaRootConfig,
  mediaRootId
} from './MediaRoot.js'

export {isMediaRoot} from './MediaRoot.js'

export function createMediaRoot<Children extends Record<string, PageSeed>>(
  children: Children = {} as Children
) {
  return root('Media', {
    icon: IcRoundPermMedia,
    contains: ['MediaLibrary'],
    view: MediaExplorer,
    entries: {
      ...createMediaRootConfig(children),
      [mediaRootId]: true
    }
  }) as any as MediaRoot<Children>
}
