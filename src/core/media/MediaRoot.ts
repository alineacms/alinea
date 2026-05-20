import {IcRoundPermMedia} from '#/dashboard/icons.js'
import type {Page} from '../Page.js'
import {type Root, root, RootOptions} from '../Root.js'

export type MediaRoot<Children extends Record<string, Page>> = Root<Children>

export function createMediaRoot<Children extends Record<string, Page>>(
  options?: RootOptions<Children>
) {
  const rootOptions = {
    icon: IcRoundPermMedia,
    contains: ['MediaLibrary'],
    ...options,
    isMediaRoot: true,
    i18n: undefined,
    // We move i18n into a separate property to persist it,
    // but don't treat media files as localised
    _media: {i18n: options?.i18n}
  }
  return root('Media', rootOptions) as MediaRoot<Children>
}
