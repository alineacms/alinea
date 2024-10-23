import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import {Page} from '../Page.js'
import {Root, root} from '../Root.js'

export type MediaRoot<Children extends Record<string, Page>> = Root<Children>

export function createMediaRoot<Children extends Record<string, Page>>(
  children: Children = {} as Children
) {
  return root('Media', {
    icon: IcRoundPermMedia,
    contains: ['MediaLibrary'],
    view: 'alinea/dashboard/view/MediaExplorer#MediaExplorer',
    isMediaRoot: true,
    entries: {
      ...children
    }
  }) as MediaRoot<Children>
}
