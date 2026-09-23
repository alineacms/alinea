import {useMemo, useState} from 'react'
import {IcRoundRefresh, LucideFile} from '../dashboard/icons.js'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {
  Table,
  type TableColumn,
  TableCell,
  TableRow,
  TableThumbnail,
  TableTitle
} from './Table.js'
import {Select, SelectItem} from './Select.js'
import type {Key, Selection, SortDescriptor} from './types.js'

interface Article {
  id: string
  title: string
  path: string
  publicationDate: string
  createdBy: string
  updatedBy: string
  ownerRegion: string
  visibility: string
  hue: number
}

const titles = [
  'Meet our senior fellow in quantum sensing',
  'How hyperscalers are rethinking AI infrastructure',
  'Four decades of in-fab metrology and inspection: pivotal milestones',
  'Towards scalable single-molecule biosensing',
  'Biomanufacturing innovations for complex therapeutics',
  'Neural telemetry breakthrough: new chip delivers ten-fold compression',
  'Transforming lab-in-the-loop protein engineering',
  'When does it make sense to move from a monolith',
  'A flexible sensor that repairs itself',
  'Two research centers formalize a shared vision',
  'Photonics on a chip, explained',
  '2025 in twelve highlights'
]
const people = ['Niels', 'Cat', 'Jade', 'Maarten', 'Els']
const regions = ['International', 'Netherlands', 'Belgium']

const articles: Array<Article> = titles.map((title, index) => ({
  id: `article-${index}`,
  title,
  path: title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
  publicationDate: `2026-${String(9 - (index % 9)).padStart(2, '0')}-${String(
    28 - index * 2
  ).padStart(2, '0')}`,
  createdBy: people[index % people.length],
  updatedBy: people[(index + 3) % people.length],
  ownerRegion: regions[index % 3 === 2 ? 1 : 0],
  visibility: regions[index % 4 === 3 ? 2 : 0],
  hue: (index * 47) % 360
}))

function thumbnail(hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${hue + 60} 60% 25%)"/></linearGradient></defs><rect width="96" height="64" fill="url(#g)"/><circle cx="64" cy="26" r="14" fill="white" fill-opacity=".25"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function sortArticles(items: Array<Article>, sort: SortDescriptor) {
  const key = sort.column as keyof Article
  const sorted = [...items].sort((a, b) =>
    String(a[key]).localeCompare(String(b[key]))
  )
  return sort.direction === 'asc' ? sorted : sorted.reverse()
}

const articleColumns: Array<TableColumn> = [
  {id: 'thumbnail', header: 'Thumbnail', width: 104},
  {id: 'title', header: 'Title', width: '2fr', minWidth: 260, sortable: true},
  {
    id: 'publicationDate',
    header: 'Publication date',
    width: 140,
    sortable: true
  },
  {id: 'createdBy', header: 'Created by', width: '1fr', minWidth: 110},
  {id: 'updatedBy', header: 'Updated by', width: '1fr', minWidth: 110},
  {
    id: 'ownerRegion',
    header: 'Owner region',
    width: '1fr',
    minWidth: 130,
    sortable: true
  },
  {id: 'visibility', header: 'Visibility', width: 140}
]

/**
 * A custom root view, as configured with `Config.root({view})`, that lists
 * the root's articles with its own columns, filters and column headers.
 */
export function CustomRootView() {
  const [region, setRegion] = useState<string | null>(null)
  const [sort, setSort] = useState<SortDescriptor>({
    column: 'publicationDate',
    direction: 'desc'
  })
  const [selected, setSelected] = useState<Selection>(new Set())
  const [opened, setOpened] = useState<Key | null>(null)
  const items = useMemo(
    () =>
      sortArticles(
        articles.filter(article => !region || article.ownerRegion === region),
        sort
      ),
    [region, sort]
  )
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: 560,
        padding: 16,
        background: 'var(--alinea-bg-muted)'
      }}
    >
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 12}}>
        <Select
          label="Owner region"
          placeholder="All owner regions"
          value={region}
          onValueChange={setRegion}
          style={{width: 240}}
        >
          {regions.map(name => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </Select>
        <span style={{marginLeft: 'auto', color: 'var(--alinea-fg-muted)'}}>
          {opened && `Opened ${articles.find(a => a.id === opened)?.title} · `}
          {items.length} articles
        </span>
        <Button
          variant="outline"
          size="icon"
          icon={IcRoundRefresh}
          aria-label="Refresh"
        />
      </div>
      <Table
        aria-label="Articles"
        items={items}
        columns={articleColumns}
        rowHeight={64}
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        sortDescriptor={sort}
        onSortChange={setSort}
        onRowAction={setOpened}
        renderEmptyState={() => 'No articles in this region'}
      >
        {article => (
          <TableRow id={article.id} textValue={article.title}>
            <TableThumbnail src={thumbnail(article.hue)} />
            <TableTitle title={article.title} />
            <TableCell>{article.publicationDate}</TableCell>
            <TableCell>{article.createdBy}</TableCell>
            <TableCell>{article.updatedBy}</TableCell>
            <TableCell>{article.ownerRegion}</TableCell>
            <TableCell>
              <Badge size="sm">{article.visibility}</Badge>
            </TableCell>
          </TableRow>
        )}
      </Table>
    </div>
  )
}

const explorerColumns: Array<TableColumn> = [
  {id: 'title', header: 'Title', width: 300},
  {id: 'path', header: 'Path', width: '1fr', minWidth: 120},
  {id: 'publicationDate', header: 'Publication date', width: '1fr'},
  {id: 'type', header: 'Type', width: '1fr'},
  {id: 'owner', header: 'Owner', width: '1fr'},
  {id: 'visibility', header: 'Visibility', width: '1fr'}
]

/** The same data presented like the dashboard explorer does today */
export function ExplorerStyle() {
  const [selected, setSelected] = useState<Selection>(new Set())
  return (
    <div
      style={{height: 480, padding: 16, background: 'var(--alinea-bg-muted)'}}
    >
      <Table
        aria-label="Articles"
        items={articles}
        columns={explorerColumns}
        showHeader={false}
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
      >
        {article => (
          <TableRow id={article.id} textValue={article.title}>
            <TableTitle icon={LucideFile} title={article.title} />
            <TableCell label="Path">{article.path}</TableCell>
            <TableCell label="Publication date">
              {article.publicationDate}
            </TableCell>
            <TableCell label="Type">Article</TableCell>
            <TableCell label="Owner">{article.ownerRegion}</TableCell>
            <TableCell label="Visibility">
              <Badge size="sm">{article.visibility}</Badge>
            </TableCell>
          </TableRow>
        )}
      </Table>
    </div>
  )
}

interface Folder {
  id: string
  title: string
  children: Array<Folder>
}

const folders: Array<Folder> = [
  {
    id: 'news',
    title: 'News',
    children: [
      {id: 'news-2026', title: '2026', children: []},
      {id: 'news-2025', title: '2025', children: []}
    ]
  },
  {id: 'events', title: 'Events', children: []}
]

function FolderRow({folder}: {folder: Folder}) {
  return (
    <TableRow
      id={folder.id}
      textValue={folder.title}
      hasChildren={folder.children.length > 0}
      rows={folder.children.map(child => (
        <FolderRow key={child.id} folder={child} />
      ))}
    >
      <TableTitle icon={LucideFile} title={folder.title} />
      <TableCell label="Entries">{folder.children.length}</TableCell>
    </TableRow>
  )
}

export function NestedRows() {
  return (
    <div style={{height: 260, padding: 16}}>
      <Table
        aria-label="Folders"
        items={folders}
        columns={[
          {id: 'title', header: 'Title', width: '2fr'},
          {id: 'entries', header: 'Entries', width: '1fr'}
        ]}
        showHeader={false}
        expandable
      >
        {folder => <FolderRow folder={folder} />}
      </Table>
    </div>
  )
}

/** Single line rows, like the dashboard's compact link picker */
export function Compact() {
  return (
    <div style={{height: 260, width: 420, padding: 16}}>
      <Table
        aria-label="Pages"
        items={folders}
        columns={[{id: 'title', header: 'Title', width: '1fr'}]}
        showHeader={false}
        variant="plain"
        selectionMode="single"
      >
        {folder => (
          <TableRow id={folder.id} textValue={folder.title}>
            <TableTitle icon={LucideFile} title={folder.title} />
          </TableRow>
        )}
      </Table>
    </div>
  )
}

interface Page {
  id: string
  title: string
  path: string
  locked?: boolean
}

const initialPages: Array<Page> = [
  {id: 'home', title: 'Home', path: '/'},
  {id: 'about', title: 'About us', path: '/about'},
  {id: 'news', title: 'News', path: '/news'},
  {id: 'legal', title: 'Legal', path: '/legal', locked: true}
]

/**
 * The explorer behaviours: drag rows by their icon onto another row, drop
 * files on the table, unselectable (locked) and highlighted rows, a
 * breadcrumb line above the title and columns that collapse on small screens
 */
export function DragAndDrop() {
  const [pages, setPages] = useState(initialPages)
  const [log, setLog] = useState<Array<string>>([])
  const [selected, setSelected] = useState<Selection>(new Set())
  const titleOf = (key: Key) => pages.find(page => page.id === key)?.title
  return (
    <div
      style={{height: 320, padding: 16, background: 'var(--alinea-bg-muted)'}}
    >
      <Table
        aria-label="Pages"
        items={pages}
        columns={[
          {id: 'title', header: 'Title', width: 300},
          {id: 'path', header: 'Path', width: '1fr', collapsible: true}
        ]}
        showHeader={false}
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        getDragData={keys =>
          [...keys].map(key => ({'text/plain': String(key)}))
        }
        canDrop={target => target.position === 'on'}
        onMove={({keys, target}) => {
          const moved = [...keys].map(titleOf).join(', ')
          setLog(log => [...log, `Moved ${moved} into ${titleOf(target.key)}`])
          setPages(pages => pages.filter(page => !keys.has(page.id)))
        }}
        onDropFiles={({files}) =>
          setLog(log => [
            ...log,
            `Uploaded ${files.map(f => f.name).join(', ')}`
          ])
        }
      >
        {page => (
          <TableRow
            id={page.id}
            textValue={page.title}
            selectable={!page.locked}
            highlighted={page.id === 'home'}
            onDoubleClick={() =>
              setLog(log => [...log, `Opened ${page.title}`])
            }
          >
            <TableTitle
              icon={LucideFile}
              title={page.title}
              label="Main / Pages"
            />
            <TableCell label="Path">{page.path}</TableCell>
          </TableRow>
        )}
      </Table>
      <output data-testid="log">{log.join('. ')}</output>
    </div>
  )
}

export function Empty() {
  return (
    <div style={{height: 200, padding: 16}}>
      <Table
        aria-label="Articles"
        items={[]}
        columns={articleColumns}
        renderEmptyState={() => 'No articles yet'}
      >
        {(article: Article) => (
          <TableRow id={article.id} textValue={article.title}>
            <TableTitle title={article.title} />
          </TableRow>
        )}
      </Table>
    </div>
  )
}

export default {
  title: 'Pure components / Table'
}
