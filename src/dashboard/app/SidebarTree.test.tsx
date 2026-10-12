import {Tree} from '#/components.js'
import type {RootTreeItem, RootTreeNode} from '#/dashboard/atoms/root.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {cms} from '../fixture/cms.js'
import {SidebarTreeItem} from './SidebarTree.js'

afterEach(cleanup)

const parent: RootTreeItem = {
  id: 'parent',
  title: 'Parent',
  type: 'Page',
  status: 'published',
  main: true,
  locale: null,
  parentId: null,
  parents: [],
  hasChildren: false
}

function renderItem(item: RootTreeNode) {
  return (
    <SidebarTreeItem
      data={parent}
      entryLink={entry => ({href: `/entry/main/pages/${entry.id}?view=edit`})}
      item={item}
      locale={null}
    >
      {renderItem}
    </SidebarTreeItem>
  )
}

test('entry labels link from the current dashboard pathname', () => {
  const previousUrl = window.location.href
  window.location.href = 'http://localhost/admin#/entry/main/pages/current'
  try {
    render(
      <StoryProvider config={cms.config}>
        <Tree aria-label="Content tree" items={[{id: 'parent', children: []}]}>
          {renderItem}
        </Tree>
      </StoryProvider>
    )

    expect(
      screen.getByRole('link', {name: 'Parent'}).getAttribute('href')
    ).toBe('/admin#/entry/main/pages/parent?view=edit')
  } finally {
    window.location.href = previousUrl
  }
})
