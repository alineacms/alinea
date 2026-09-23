import {useState} from 'react'
import {IcTwotoneDescription, IcTwotoneFolder} from '../dashboard/icons.js'
import {ContentCard, ContentCardSkeleton} from './ContentCard.js'
import {ContentGrid, ContentGridItem} from './ContentGrid.js'
import type {Key, Selection} from './types.js'

interface Photo {
  id: string
  title: string
  hue: number
  width: number
  height: number
}

const photos: Array<Photo> = [
  'Harbour at dawn',
  'Forest trail',
  'City lights',
  'Desert dunes',
  'Glacier bay',
  'Market square',
  'Lighthouse',
  'Vineyard rows'
].map((title, index) => ({
  id: `photo-${index}`,
  title,
  hue: (index * 53) % 360,
  width: 1600 + index * 40,
  height: 1067
}))

function image(hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 60%)"/><stop offset="1" stop-color="hsl(${hue + 50} 60% 28%)"/></linearGradient></defs><rect width="240" height="160" fill="url(#g)"/><circle cx="170" cy="56" r="26" fill="white" fill-opacity=".3"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * A custom root view, as configured with `Config.root({view})`, that shows
 * the images of a root as cards, with selection and uploads by dropping files
 */
export function CustomRootView() {
  const [selected, setSelected] = useState<Selection>(new Set())
  const [opened, setOpened] = useState<Key | null>(null)
  const [uploads, setUploads] = useState<Array<string>>([])
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 560,
        background: 'var(--alinea-bg-muted)'
      }}
    >
      <div style={{padding: '12px 16px', color: 'var(--alinea-fg-muted)'}}>
        <output data-testid="status">
          {selected === 'all' ? 'All' : selected.size} selected
          {opened && ` · Opened ${photos.find(p => p.id === opened)?.title}`}
          {uploads.length > 0 && ` · Uploaded ${uploads.join(', ')}`}
        </output>
      </div>
      <ContentGrid
        aria-label="Photos"
        items={photos}
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onItemAction={setOpened}
        dropLabel="Drop files to upload"
        onDropFiles={({files}) =>
          setUploads(uploads => [...uploads, ...files.map(file => file.name)])
        }
        style={{flex: 1}}
      >
        {photo => (
          <ContentGridItem id={photo.id} textValue={photo.title}>
            <ContentCard
              variant="media"
              image={image(photo.hue)}
              color={`hsl(${photo.hue} 40% 40%)`}
              title={photo.title}
              breadcrumbs={['Media', 'Photos']}
              description="SVG"
              details={`${photo.width}×${photo.height} - 24 kB`}
            />
          </ContentGridItem>
        )}
      </ContentGrid>
    </div>
  )
}

interface Entry {
  id: string
  title: string
  folder?: boolean
  loading?: boolean
  locked?: boolean
}

const entries: Array<Entry> = [
  {id: 'news', title: 'News', folder: true},
  {id: 'about', title: 'About us'},
  {id: 'contact', title: 'Contact'},
  {id: 'legal', title: 'Legal', locked: true},
  {id: 'loading', title: 'Loading entry', loading: true}
]

/** Entries like the dashboard explorer shows them in card view */
export function ExplorerStyle() {
  const [selected, setSelected] = useState<Selection>(new Set())
  const [moved, setMoved] = useState('')
  return (
    <div style={{height: 480, background: 'var(--alinea-bg-muted)'}}>
      <ContentGrid
        aria-label="Entries"
        items={entries}
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        getDragData={keys =>
          [...keys].map(key => ({'text/plain': String(key)}))
        }
        canDrop={target =>
          target.position === 'on' &&
          entries.find(entry => entry.id === target.key)?.folder === true
        }
        onMove={({keys, target}) =>
          setMoved(`Moved ${[...keys].join(', ')} into ${target.key}`)
        }
      >
        {entry =>
          entry.loading ? (
            <ContentGridItem
              id={entry.id}
              textValue={entry.title}
              selectable={false}
            >
              <ContentCardSkeleton />
            </ContentGridItem>
          ) : (
            <ContentGridItem
              id={entry.id}
              textValue={entry.title}
              selectable={!entry.locked}
            >
              <ContentCard
                icon={entry.folder ? IcTwotoneFolder : IcTwotoneDescription}
                title={entry.title}
                description="Page"
              />
            </ContentGridItem>
          )
        }
      </ContentGrid>
      <output data-testid="moved">{moved}</output>
    </div>
  )
}

export function Empty() {
  return (
    <div style={{height: 240}}>
      <ContentGrid
        aria-label="Photos"
        items={[] as Array<Photo>}
        renderEmptyState={() => 'No photos yet'}
      >
        {photo => (
          <ContentGridItem id={photo.id} textValue={photo.title}>
            <ContentCard title={photo.title} />
          </ContentGridItem>
        )}
      </ContentGrid>
    </div>
  )
}

export default {
  title: 'Pure components / ContentGrid'
}
