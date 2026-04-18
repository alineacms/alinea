import {IcRoundPermMedia} from '#/dashboard/icons.js'
import type {Page} from '../Page.js'
import {type Root, root} from '../Root.js'

export type MediaRoot<Children extends Record<string, Page>> = Root<Children>

export function createMediaRoot<Children extends Record<string, Page>>(
  children: Children = {} as Children
) {
  return root('Media', {
    icon: IcRoundPermMedia,
    contains: ['MediaLibrary'],
    isMediaRoot: true,
    children: {
      ...children
    }
  }) as MediaRoot<Children>
}
