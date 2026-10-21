import {LucideImage} from '#/dashboard/icons.js'
import type {Page} from '../Page.js'
import {mediaOverview} from './MediaTypes.js'
import {type Root, root, RootOptions} from '../Root.js'

export type MediaRoot<Children extends Record<string, Page>> = Root<Children>

export function createMediaRoot<Children extends Record<string, Page>>(
  options?: RootOptions<Children>
) {
  const rootOptions = {
    icon: LucideImage,
    contains: ['MediaLibrary'],
    overview: mediaOverview(),
    ...options,
    isMediaRoot: true,
    // A file is a single entry, its alt text holds a value per locale
    i18n: options?.i18n && {...options.i18n, translate: 'fields' as const}
  }
  return root('Media', rootOptions) as MediaRoot<Children>
}
