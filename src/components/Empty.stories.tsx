import type {CSSProperties} from 'react'
import {
  IcBaselineErrorOutline,
  IcRoundAdd,
  IcRoundSearch,
  LucideFile
} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from './Empty.js'
import {Icon} from './Icon.js'

const storyStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 24,
  padding: 24,
  background: 'var(--alinea-bg-muted)'
}

const frameStyle: CSSProperties = {
  display: 'flex',
  minHeight: 280,
  border: '1px dashed var(--alinea-border)',
  borderRadius: 'var(--alinea-radius-lg)',
  background: 'var(--alinea-bg)'
}

export function Example() {
  return (
    <div style={storyStyle}>
      <div style={frameStyle}>
        <Empty aria-label="No pages">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon icon={LucideFile} />
            </EmptyMedia>
            <EmptyTitle>No pages yet</EmptyTitle>
            <EmptyDescription>
              Pages you create in this root show up here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button color="primary" icon={IcRoundAdd}>
              Create page
            </Button>
          </EmptyContent>
        </Empty>
      </div>
      <div style={frameStyle}>
        <Empty aria-label="Search">
          <EmptyHeader>
            <EmptyMedia>
              <Icon icon={IcRoundSearch} />
            </EmptyMedia>
            <EmptyTitle>Search</EmptyTitle>
            <EmptyDescription>Type to find a page.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}

export function Card() {
  return (
    <div style={{...storyStyle, display: 'flex', justifyContent: 'center'}}>
      <Empty variant="card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon icon={IcBaselineErrorOutline} />
          </EmptyMedia>
          <EmptyTitle as="h1">Entry not found</EmptyTitle>
          <EmptyDescription>
            The requested entry could not be found. It may have been deleted,
            moved, or is no longer available.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline">Go to Pages</Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}

export default {
  title: 'Pure components / Empty'
}
