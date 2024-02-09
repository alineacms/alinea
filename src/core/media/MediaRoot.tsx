import {PageSeed} from '../Page.js'
import {Root, root} from '../Root.js'

export type MediaRoot<Children extends Record<string, PageSeed>> =
  Root<Children>

export const mediaRootId = Symbol.for('@alinea/mediaRoot')

export function isMediaRoot(
  root: any
): root is MediaRoot<Record<string, PageSeed>> {
  return Boolean(root[mediaRootId])
}

export function createMediaRoot<Children extends Record<string, PageSeed>>(
  children: Children = {} as Children
) {
  return root('Media', {
    contains: ['MediaLibrary'],
    entries: {
      ...children,
      [mediaRootId]: true
    }
  }) as any as MediaRoot<Children>
}
