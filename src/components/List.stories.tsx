import styler from '@alinea/styler'
import type {ComponentType, ReactNode} from 'react'
import type {EntryStatus} from '#/core/Entry.js'
import {
  IcOutlineDrafts,
  IcRoundArchive,
  IcRoundCheck,
  IcRoundClose,
  IcRoundEdit,
  IcRoundHistory,
  IcRoundImage,
  IcRoundInsertDriveFile,
  IcRoundLink,
  IcRoundSync,
  IcOutlineSettings as IcRoundSettings
} from '#/dashboard/icons.js'
import {Button} from './Button.js'
import {
  List,
  ListEmpty,
  ListItem,
  ListItemDescription,
  ListItemStatus,
  ListItemTitle,
  ListItemVisual
} from './List.js'
import css from './List.stories.module.css'
import {Surface, SurfaceContent} from './Surface.js'
import {TextField} from './TextField.js'

const styles = styler(css)

const itemControls = (
  <div style={{display: 'flex'}}>
    <Button size="icon" variant="ghost" icon={IcRoundEdit} />
    <Button size="icon" variant="ghost" icon={IcRoundClose} />
  </div>
)

export function Basic() {
  return (
    <List>
      <ListItem
        inner="This is a simple list item with a short description."
        trailing={itemControls}
      >
        <strong>Welcome</strong>
      </ListItem>
      <ListItem
        inner="Drafts updated by your team show up here."
        trailing={itemControls}
      >
        <strong>Recent activity</strong>
      </ListItem>
      <ListItem
        leading={<IcRoundSettings data-slot="icon" />}
        trailing={itemControls}
        inner={
          <Surface>
            <SurfaceContent>
              <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                You can put more complex content in the body, including links
                and controls.
                <TextField
                  placeholder="Type something..."
                  label="Inner field"
                />
              </div>
            </SurfaceContent>
          </Surface>
        }
      >
        <strong>About this workspace</strong>
      </ListItem>
    </List>
  )
}

interface ExampleProps {
  children: ReactNode
  count: string
  title: string
}

function Example({children, count, title}: ExampleProps) {
  return (
    <section className={styles.SmallLists.example()}>
      <header className={styles.SmallLists.header()}>
        <h2 className={styles.SmallLists.title()}>{title}</h2>
        <span className={styles.SmallLists.count()}>{count}</span>
      </header>
      {children}
    </section>
  )
}

interface ReferenceExample {
  fields: string
  icon: ComponentType
  locale: string
  path: string
  statuses: Array<EntryStatus>
  title: string
}

const references: Array<ReferenceExample> = [
  {
    title: 'Home',
    fields: 'Hero image, Social image',
    path: '/home',
    locale: 'EN',
    statuses: ['draft', 'published'],
    icon: IcRoundImage
  },
  {
    title: 'About',
    fields: 'Body',
    path: '/about',
    locale: 'EN',
    statuses: ['published'],
    icon: IcRoundLink
  },
  {
    title: 'Release notes',
    fields: 'Attachment',
    path: '/blog/release-notes',
    locale: 'EN',
    statuses: ['draft'],
    icon: IcRoundInsertDriveFile
  }
]

interface HistoryExample {
  description: string
  icon: ComponentType
  meta: string
  status: EntryStatus
  title: string
}

const history: Array<HistoryExample> = [
  {
    title: 'Published',
    description: 'Current version',
    meta: 'Ben · 11/08/2026 - 10:42',
    status: 'published',
    icon: IcRoundCheck
  },
  {
    title: 'Draft',
    description: 'Current version · Editing',
    meta: 'Ben · 11/08/2026 - 10:48',
    status: 'draft',
    icon: IcOutlineDrafts
  },
  {
    title: '10/08/2026 - 16:06',
    description: 'Previous version',
    meta: 'Ben · Archived',
    status: 'archived',
    icon: IcRoundArchive
  }
]

interface QueueExample {
  error?: string
  mutations: Array<string>
  status: 'pending' | 'syncing' | 'failed' | 'blocked'
  title: string
}

const queue: Array<QueueExample> = [
  {
    title: 'Home',
    status: 'syncing',
    mutations: ['Updated draft (EN)', 'Published (EN)']
  },
  {
    title: 'panorama.jpg',
    status: 'pending',
    mutations: ['Uploading file 68%']
  },
  {
    title: 'Release notes',
    status: 'failed',
    mutations: ['Updated published version (EN)'],
    error: 'The remote branch changed. Retry to sync the latest version.'
  }
]

function statusLabel(status: EntryStatus): string {
  return status[0].toUpperCase() + status.slice(1)
}

function queueStatusLabel(status: QueueExample['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'syncing':
      return 'Syncing'
    case 'failed':
      return 'Failed'
    case 'blocked':
      return 'Waiting'
  }
}

function entryStatusColor(status: EntryStatus) {
  switch (status) {
    case 'published':
      return 'success' as const
    case 'draft':
      return 'primary' as const
    case 'archived':
      return 'muted' as const
  }
}

function queueStatusColor(status: QueueExample['status']) {
  switch (status) {
    case 'syncing':
      return 'primary' as const
    case 'pending':
    case 'blocked':
      return 'warning' as const
    case 'failed':
      return 'destructive' as const
  }
}

export function SmallLists() {
  return (
    <div className={styles.SmallLists()}>
      <Example title="References" count={`${references.length} entries`}>
        <List aria-label="References" className={styles.SmallLists.list()}>
          {references.map(reference => (
            <ListItem
              key={`${reference.path}:${reference.locale}`}
              onClick={() => undefined}
              leading={
                <ListItemVisual className={styles.SmallLists.visual()}>
                  <reference.icon data-slot="icon" />
                </ListItemVisual>
              }
              trailing={
                <span className={styles.SmallLists.trailing()}>
                  {reference.statuses.map(status => (
                    <ListItemStatus
                      key={status}
                      color={entryStatusColor(status)}
                    >
                      {statusLabel(status)}
                    </ListItemStatus>
                  ))}
                </span>
              }
            >
              <ListItemTitle>{reference.title}</ListItemTitle>
              <ListItemDescription>
                {reference.fields} · {reference.path} · {reference.locale}
              </ListItemDescription>
            </ListItem>
          ))}
        </List>
      </Example>

      <Example title="History" count="2 current · 1 previous">
        <List aria-label="History" className={styles.SmallLists.list()}>
          {history.map((revision, index) => (
            <ListItem
              key={`${revision.title}:${index}`}
              onClick={() => undefined}
              leading={
                <ListItemVisual className={styles.SmallLists.visual()}>
                  <revision.icon data-slot="icon" />
                </ListItemVisual>
              }
              trailing={
                <ListItemStatus color={entryStatusColor(revision.status)}>
                  {statusLabel(revision.status)}
                </ListItemStatus>
              }
            >
              <ListItemTitle>{revision.title}</ListItemTitle>
              <ListItemDescription>
                {revision.description} · {revision.meta}
              </ListItemDescription>
            </ListItem>
          ))}
        </List>
      </Example>

      <Example title="Mutation queue" count={`${queue.length} changes`}>
        <List aria-label="Mutation queue" className={styles.SmallLists.list()}>
          {queue.map(entry => (
            <ListItem
              key={entry.title}
              role="listitem"
              leading={
                <ListItemVisual className={styles.SmallLists.visual()}>
                  {entry.status === 'syncing' ? (
                    <IcRoundSync data-slot="icon" />
                  ) : entry.status === 'failed' ? (
                    <IcRoundClose data-slot="icon" />
                  ) : (
                    <IcRoundHistory data-slot="icon" />
                  )}
                </ListItemVisual>
              }
              trailing={
                <ListItemStatus color={queueStatusColor(entry.status)}>
                  {queueStatusLabel(entry.status)}
                </ListItemStatus>
              }
              inner={
                entry.error && (
                  <p className={styles.SmallLists.error()}>{entry.error}</p>
                )
              }
            >
              <ListItemTitle>{entry.title}</ListItemTitle>
              <ListItemDescription>
                {entry.mutations.join(' · ')}
              </ListItemDescription>
            </ListItem>
          ))}
        </List>
      </Example>
    </div>
  )
}

export function EmptySmallLists() {
  return (
    <div className={styles.SmallLists()}>
      <Example title="References" count="0 entries">
        <List
          aria-label="Empty references"
          className={styles.SmallLists.list()}
          empty
        >
          <ListEmpty icon={IcRoundLink} title="No references">
            This entry is not referenced anywhere.
          </ListEmpty>
        </List>
      </Example>

      <Example title="History" count="0 previous">
        <List
          aria-label="Empty history"
          className={styles.SmallLists.list()}
          empty
        >
          <ListEmpty icon={IcRoundHistory} title="No history">
            No previous versions yet.
          </ListEmpty>
        </List>
      </Example>

      <Example title="Mutation queue" count="0 changes">
        <List
          aria-label="Empty mutation queue"
          className={styles.SmallLists.list()}
          empty
        >
          <ListEmpty icon={IcRoundCheck} title="Up to date">
            All changes are synced.
          </ListEmpty>
        </List>
      </Example>
    </div>
  )
}

export default {title: 'Pure components / List'}
