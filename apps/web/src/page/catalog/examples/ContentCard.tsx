'use client'

import {ContentCard, ContentGrid, ContentGridItem} from 'alinea/components'
import {IcTwotoneDescription} from 'alinea/dashboard/icons'

const entries = [{id: 'post'}, {id: 'image'}]

export function ContentCardExample() {
  return (
    <div style={{width: 460, height: 240}}>
      <ContentGrid aria-label="Entries" items={entries} minItemWidth={180}>
        {entry => (
          <ContentGridItem id={entry.id} textValue={entry.id}>
            {entry.id === 'post' ? (
              <ContentCard
                icon={IcTwotoneDescription}
                title="Caring for linen"
                breadcrumbs={['Journal']}
                description="Blog post"
              />
            ) : (
              <ContentCard
                variant="media"
                image="/catalog/workshop-bench.jpg"
                color="#8a6f55"
                title="workshop-bench.jpg"
                breadcrumbs={['Media', 'Workshop']}
                description="JPG"
                details="480×320 · 38 kB"
              />
            )}
          </ContentGridItem>
        )}
      </ContentGrid>
    </div>
  )
}
