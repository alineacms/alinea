import {PageSeed} from '../Page.js'
import {Root, root} from '../Root.js'

export type MediaRoot<Children extends Record<string, PageSeed>> =
  Root<Children>

export function createMediaRoot<Children extends Record<string, PageSeed>>(
  children: Children = {} as Children
) {
  return root('Media', {
    contains: ['MediaLibrary'],
    isMediaRoot: true,
    entries: {
      ...children
    }
  }) as any as MediaRoot<Children>
}
