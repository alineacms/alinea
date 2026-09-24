'use client'

import {ContentCard, ContentGrid, ContentGridItem} from 'alinea/components'

const images = [
  {id: 'oak-dining-chair'},
  {id: 'walnut-stools'},
  {id: 'ceramic-table-lamp'}
]

export function ContentGridExample() {
  return (
    <div style={{width: 640, height: 240}}>
      <ContentGrid
        aria-label="Product images"
        items={images}
        selectionMode="multiple"
        showSelectionControls
        defaultSelectedKeys={new Set(['walnut-stools'])}
        minItemWidth={180}
      >
        {image => (
          <ContentGridItem id={image.id} textValue={image.id}>
            <ContentCard
              variant="media"
              image={`/catalog/${image.id}.jpg`}
              title={`${image.id}.jpg`}
              breadcrumbs={['Media', 'Products']}
              description="JPG"
            />
          </ContentGridItem>
        )}
      </ContentGrid>
    </div>
  )
}
