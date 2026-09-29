import {Page, PageContent} from '#/components.js'
import type {ExplorerItemData} from '#/dashboard/atoms/explorer.js'
import {cms} from '#/dashboard/fixture/cms.ts?alinea'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {useState, type CSSProperties} from 'react'
import {
  ExplorerBatchActionBar,
  ExplorerDeleteDialog
} from './ExplorerBatchActions.js'

const frame: CSSProperties = {display: 'flex', height: 320}

function item(
  id: string,
  title: string,
  type: string,
  hasChildren = false
): ExplorerItemData {
  return {
    id,
    title,
    path: id,
    type,
    workspace: 'simple',
    root: 'media',
    locale: null,
    parentId: null,
    parents: [],
    index: 'a0',
    data: {},
    hasChildren,
    status: 'published',
    seeded: null
  }
}

function noop() {}

async function wait() {
  await new Promise(resolve => setTimeout(resolve, 600))
}

interface ActionBarStoryProps {
  count: number
  canDelete?: boolean
  canMove?: boolean
  isPending?: boolean
}

function ActionBarStory({
  count,
  canDelete = true,
  canMove = true,
  isPending
}: ActionBarStoryProps) {
  return (
    <StoryProvider config={cms.config}>
      <div style={frame}>
        <Page>
          <PageContent />
          <ExplorerBatchActionBar
            count={count}
            canDelete={canDelete}
            canMove={canMove}
            isPending={isPending}
            onClear={noop}
            onDelete={noop}
            onMove={noop}
          />
        </Page>
      </div>
    </StoryProvider>
  )
}

export function TwoSelected() {
  return <ActionBarStory count={2} />
}

export function LoadingMoveTargets() {
  return <ActionBarStory count={12} isPending />
}

/** Published pages are archived before they can be deleted */
export function MoveOnly() {
  return <ActionBarStory count={3} canDelete={false} />
}

interface DeleteDialogStoryProps {
  items: Array<ExplorerItemData>
}

function DeleteDialogStory({items}: DeleteDialogStoryProps) {
  const [open, setOpen] = useState(true)
  return (
    <StoryProvider config={cms.config}>
      <button type="button" onClick={() => setOpen(true)}>
        Delete
      </button>
      <ExplorerDeleteDialog
        items={items}
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={wait}
      />
    </StoryProvider>
  )
}

export function DeleteFiles() {
  return (
    <DeleteDialogStory
      items={[
        item('one', 'Portrait.jpg', 'MediaFile'),
        item('two', 'Panorama.jpg', 'MediaFile')
      ]}
    />
  )
}

export function DeleteFilesAndFolders() {
  return (
    <DeleteDialogStory
      items={[
        item('one', 'Portrait.jpg', 'MediaFile'),
        item('photos', 'Photos', 'MediaLibrary', true),
        item('press', 'Press kit', 'MediaLibrary')
      ]}
    />
  )
}

export function DeleteSingleEntry() {
  return <DeleteDialogStory items={[item('about', 'About us', 'Page', true)]} />
}

export default {
  title: 'Dashboard / ExplorerBatchActions'
}
