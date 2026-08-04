import {afterEach, expect, test} from 'bun:test'
import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {Tree} from '#/components.js'
import type {RootTreeItem} from '#/dashboard/atoms/root.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {useState} from 'react'
import type {Key} from 'react-aria-components'
import {cms} from '../fixture/cms.js'
import {SidebarTreeItem} from './SidebarTree.js'

afterEach(cleanup)

const parent: RootTreeItem = {
  id: 'parent',
  title: 'Parent',
  type: 'Folder',
  status: 'published',
  main: true,
  locale: null,
  parentId: null,
  parents: [],
  hasChildren: true
}

const child: RootTreeItem = {
  id: 'child',
  title: 'Child',
  type: 'Page',
  status: 'published',
  main: true,
  locale: null,
  parentId: parent.id,
  parents: [parent.id],
  hasChildren: false
}

function SidebarTreeFixture() {
  const [expandedKeys, setExpandedKeys] = useState(new Set<Key>())
  const items = [parent, child]
  return (
    <StoryProvider config={cms.config}>
      <Tree
        aria-label="Content tree"
        items={[parent]}
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
      >
        {item => <SidebarTreeItem item={item} items={items} locale={null} />}
      </Tree>
    </StoryProvider>
  )
}

test('sidebar chevron opens loaded children', async () => {
  const {container} = render(<SidebarTreeFixture />)
  const chevron = container.querySelector<HTMLButtonElement>('[slot="chevron"]')

  expect(chevron).not.toBeNull()
  expect(screen.queryByText('Child')).toBeNull()
  fireEvent.click(chevron!)

  expect(await screen.findByText('Child')).toBeTruthy()
})
