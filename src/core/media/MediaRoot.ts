import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import {IcRoundPermMedia} from 'alinea/ui/icons/IcRoundPermMedia'
import type {Page} from '../Page.js'
import {type Root, root} from '../Root.js'

export type MediaRoot<Children extends Record<string, Page>> = Root<Children>

export function createMediaRoot<Children extends Record<string, Page>>(
  children: Children = {} as Children
) {
  return root('Media', {
    icon: IcRoundPermMedia,
    contains: ['MediaLibrary'],
    view: viewKeys.MediaExplorer,
    isMediaRoot: true,
    children: {
      ...children
    }
  }) as MediaRoot<Children>
}
