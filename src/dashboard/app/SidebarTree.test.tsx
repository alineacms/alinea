import {afterEach, expect, test} from 'bun:test'
import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {Tree} from '#/components.js'
import type {RootTreeItem, RootTreeNode} from '#/dashboard/atoms/root.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {atom} from 'jotai'
import {useMemo, useState} from 'react'
import type {Key} from 'react-aria-components'
import {cms} from '../fixture/cms.js'
import {SidebarTreeItem} from './SidebarTree.js'

afterEach(cleanup)

function treeItem(
  id: string,
  parentId: string | null,
  parents: Array<string>,
  hasChildren = false,
  title = id
): RootTreeItem {
  return {
    id,
    title,
    type: hasChildren ? 'Folder' : 'Page',
    status: 'published',
    main: true,
    locale: null,
    parentId,
    parents,
    hasChildren,
    dragDisabled: false
  }
}

const parent = treeItem('parent', null, [], true, 'Parent')
const child = treeItem('child', parent.id, [parent.id], true, 'Child')
const grandchild = treeItem(
  'grandchild',
  child.id,
  [parent.id, child.id],
  false,
  'Grandchild'
)
const noChildren = atom<Array<RootTreeNode>>([])

interface SidebarTreeFixtureProps {
  initialExpandedKeys?: Set<Key>
  items?: Array<RootTreeItem>
}

function SidebarTreeFixture({
  initialExpandedKeys = new Set<Key>(),
  items = [parent, child, grandchild]
}: SidebarTreeFixtureProps) {
  const source = useMemo(() => {
    const itemAtoms = new Map(items.map(item => [item.id, atom(item)] as const))
    const children = new Map<string | null, Array<RootTreeNode>>()
    for (const item of items) {
      const siblings = children.get(item.parentId) ?? []
      siblings.push({id: item.id})
      children.set(item.parentId, siblings)
    }
    const childrenAtoms = new Map(
      Array.from(children, ([parentId, nodes]) => [parentId, atom(nodes)])
    )
    return {
      treeChildren(_locale: string | null, parentId: string | null) {
        return childrenAtoms.get(parentId) ?? noChildren
      },
      treeItem(_locale: string | null, id: string) {
        const item = itemAtoms.get(id)
        if (!item) throw new Error(`Tree item "${id}" not found`)
        return item
      }
    }
  }, [items])
  const [expandedKeys, setExpandedKeys] = useState(initialExpandedKeys)
  const rootItems = items
    .filter(item => item.parentId === null)
    .map(item => ({id: item.id}))
  return (
    <StoryProvider config={cms.config}>
      <Tree
        aria-label="Content tree"
        items={rootItems}
        dependencies={[expandedKeys]}
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
      >
        {item => (
          <SidebarTreeItem
            expandedKeys={expandedKeys}
            item={item}
            locale={null}
            root={source}
          />
        )}
      </Tree>
    </StoryProvider>
  )
}

test('expanding materializes only immediate children and collapsing removes them', async () => {
  const {container} = render(<SidebarTreeFixture />)
  const parentChevron =
    container.querySelector<HTMLButtonElement>('[slot="chevron"]')

  expect(parentChevron).not.toBeNull()
  expect(screen.queryByText('Child')).toBeNull()
  fireEvent.click(parentChevron!)

  expect(await screen.findByText('Child')).toBeTruthy()
  expect(screen.queryByText('Grandchild')).toBeNull()

  fireEvent.click(parentChevron!)
  expect(screen.queryByText('Child')).toBeNull()
})

function largeTree(): Array<RootTreeItem> {
  const result: Array<RootTreeItem> = []
  for (let rootIndex = 0; rootIndex < 10; rootIndex++) {
    const rootId = `root-${rootIndex}`
    result.push(treeItem(rootId, null, [], true))
    for (let childIndex = 0; childIndex < 100; childIndex++) {
      result.push(treeItem(`${rootId}-child-${childIndex}`, rootId, [rootId]))
    }
  }
  return result
}

test('collapsed descendants do not materialize tree rows', () => {
  const view = render(<SidebarTreeFixture items={largeTree()} />)

  expect(screen.getAllByRole('row')).toHaveLength(10)
  expect(screen.queryByText('root-0-child-0')).toBeNull()
  expect(view.container.querySelectorAll('*').length).toBeLessThan(250)
})
