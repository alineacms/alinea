import {Page, PageContent} from '#/components.js'
import {cms} from '#/dashboard/fixture/cms.ts?alinea'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import type {CSSProperties} from 'react'
import {ExplorerBatchActionBar} from './ExplorerBatchActions.js'

const frame: CSSProperties = {
  position: 'relative',
  display: 'flex',
  height: 320
}

function noop() {}

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

/** Seeded entries can not be deleted, the action says why on hover */
export function MoveOnly() {
  return <ActionBarStory count={3} canDelete={false} />
}

export default {
  title: 'Dashboard / ExplorerBatchActions'
}
