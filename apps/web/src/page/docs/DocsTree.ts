import {Entry} from 'alinea/core/Entry'
import {cache} from 'react'
import {cms} from '@/cms'
import {Doc} from '@/schema/Doc'
import type {DocsNavGroup, DocsNavItem} from './DocsNav'

const navSelect = {
  id: Entry.id,
  url: Entry.url,
  title: Entry.title,
  index: Entry.index,
  navigationTitle: Doc.navigationTitle,
  parent: Entry.parentId
}

export interface DocsTree {
  root: DocsNavItem
  groups: Array<DocsNavGroup & {url: string}>
  urls: Map<string, {url: string}>
}

/**
 * The docs sidebar is derived from the content tree: entries directly below
 * /docs are the sidebar groups, the docs index is listed in the first group.
 * Cached per request, both the docs layout and the page read it.
 */
export const getDocsTree = cache(
  async function getDocsTree(): Promise<DocsTree> {
    const [root, entries] = await Promise.all([
      cms.get({url: '/docs', select: navSelect}),
      cms.find({location: cms.workspaces.main.pages.docs, select: navSelect})
    ])
    const byParent = new Map<string, typeof entries>()
    for (const entry of entries) {
      const siblings = byParent.get(entry.parent ?? root.id) ?? []
      siblings.push(entry)
      byParent.set(entry.parent ?? root.id, siblings)
    }
    for (const siblings of byParent.values())
      siblings.sort((a, b) =>
        a.index < b.index ? -1 : a.index > b.index ? 1 : 0
      )
    function toItem(entry: (typeof entries)[number]): DocsNavItem {
      return {
        id: entry.id,
        title: entry.navigationTitle || entry.title,
        url: entry.url,
        children: (byParent.get(entry.id) ?? []).map(toItem)
      }
    }
    const rootItem: DocsNavItem = {
      id: root.id,
      title: root.navigationTitle || root.title,
      url: root.url,
      children: []
    }
    const groups = (byParent.get(root.id) ?? []).map((group, i) => {
      const {children} = toItem(group)
      return {
        id: group.id,
        title: group.navigationTitle || group.title,
        url: group.url,
        items: i === 0 ? [rootItem, ...children] : children
      }
    })
    const urls = new Map(
      [root, ...entries].map(entry => [entry.id, {url: entry.url}])
    )
    return {root: rootItem, groups, urls}
  }
)

export function flattenDocsNav(item: DocsNavItem): Array<DocsNavItem> {
  return [item, ...item.children.flatMap(flattenDocsNav)]
}

/** All docs pages in sidebar order, used for the previous/next links */
export function docsPages(tree: DocsTree): Array<DocsNavItem> {
  return tree.groups.flatMap(group => group.items.flatMap(flattenDocsNav))
}
