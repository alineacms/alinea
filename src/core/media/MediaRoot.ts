import {viewKeys} from '#/dashboard/editor/ViewKeys.js'
import {IcRoundPermMedia} from '#/ui/icons/IcRoundPermMedia.js'
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
