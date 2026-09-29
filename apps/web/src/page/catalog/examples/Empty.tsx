'use client'

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon
} from 'alinea/components'
import {IcRoundAdd, LucideFile} from 'alinea/dashboard/icons'

export function EmptyExample() {
  return (
    <Empty variant="card" aria-label="No blog posts">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon icon={LucideFile} />
        </EmptyMedia>
        <EmptyTitle>No blog posts yet</EmptyTitle>
        <EmptyDescription>
          Posts you write in the journal show up here.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button color="primary" icon={IcRoundAdd}>
          New post
        </Button>
      </EmptyContent>
    </Empty>
  )
}
