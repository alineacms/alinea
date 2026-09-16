import styler from '@alinea/styler'
import type {ComponentType, ReactNode} from 'react'
import {useState} from 'react'
import {DialogTrigger} from 'react-aria-components'
import type {EntryStatus} from '#/core/Entry.js'
import {Badge} from '#/dashboard/app/Badge.js'
import {
  IcOutlineDrafts,
  IcOutlineGridView,
  IcRoundAttachFile,
  IcRoundArchive,
  IcRoundAccountTree,
  IcRoundCheck,
  IcRoundClose,
  IcRoundEdit,
  IcRoundHistory,
  IcRoundImage,
  IcRoundInsertDriveFile,
  IcRoundLink,
  IcRoundMoreHoriz,
  IcRoundPanorama,
  IcRoundSync,
  IcOutlineSettings as IcRoundSettings
} from '#/dashboard/icons.js'
import {Button} from './Button.js'
import {
  List,
  ListCreateButton,
  ListCreateRow,
  ListDragPreview,
  ListEmpty,
  ListError,
  ListItem,
  ListItemDescription,
  ListItemStatus,
  ListItemTitle,
  ListItemVisual,
  ListLabel,
  ListRow,
  ListRowActions,
  ListRowBadges,
  ListRowBody,
  ListRowDrag,
  ListRowFoldButton,
  ListRowFooter,
  ListRowHeader,
  ListRowMeta,
  ListRowSettings,
  ListRowType
} from './List.js'
import css from './List.stories.module.css'
import {Popover} from './Popover.js'
import {Surface, SurfaceContent} from './Surface.js'
import {TextField} from './TextField.js'
import {TypeCreateActions} from './TypeCreateActions.js'

const styles = styler(css)

const itemControls = (
  <div style={{display: 'flex'}}>
    <Button size="icon" appearance="plain" icon={IcRoundEdit} />
    <Button size="icon" appearance="plain" icon={IcRoundClose} />
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

export function FieldRows() {
  return (
    <div style={{maxWidth: 720}}>
      <ListLabel
        aria-label="Collapse all items"
        count={2}
        expanded
        hasRows
        shared
      >
        Sections
      </ListLabel>
      <List data-depth="muted">
        <ListRow aria-label="Hero item 1" first role="listitem">
          <ListRowHeader expanded first>
            <ListRowDrag>
              <ListRowBadges>
                <ListRowFoldButton
                  aria-label="Collapse hero"
                  expanded
                  onPress={() => undefined}
                />
                <ListRowType icon={IcRoundPanorama}>Hero</ListRowType>
                <ListRowMeta>Landing page intro</ListRowMeta>
                <Badge size="small">#landing-page-intro</Badge>
              </ListRowBadges>
            </ListRowDrag>
            <ListRowActions>
              <DialogTrigger>
                <Button
                  appearance="plain"
                  aria-label="Hero settings"
                  icon={IcRoundMoreHoriz}
                  size="icon-small"
                />
                <Popover placement="bottom right">
                  <ListRowSettings>
                    <TextField label="Label" value="Landing page intro" />
                    <TextField label="Anchor" value="landing-page-intro" />
                  </ListRowSettings>
                </Popover>
              </DialogTrigger>
            </ListRowActions>
          </ListRowHeader>
          <ListRowBody>
            <TextField label="Heading" value="Build structured pages" />
            <TextField
              label="Body"
              value="Compose reusable content sections with a list field."
            />
          </ListRowBody>
        </ListRow>
        <ListRow aria-label="Quote item 2" role="listitem">
          <ListRowHeader>
            <ListRowDrag>
              <ListRowBadges>
                <ListRowFoldButton
                  aria-label="Expand quote"
                  expanded={false}
                  onPress={() => undefined}
                />
                <ListRowType>Quote</ListRowType>
                <ListRowMeta>Editorial quote</ListRowMeta>
              </ListRowBadges>
            </ListRowDrag>
            <ListRowActions>
              <Button
                appearance="plain"
                aria-label="Quote settings"
                icon={IcRoundMoreHoriz}
                size="icon-small"
              />
            </ListRowActions>
          </ListRowHeader>
          <ListRowFooter>
            Quote: Content editing should stay close...
          </ListRowFooter>
        </ListRow>
      </List>
      <ListCreateRow>
        <Button appearance="plain" size="small">
          Add Hero
        </Button>
        <Button appearance="plain" size="small">
          Add Quote
        </Button>
      </ListCreateRow>
      <ListError>At least one section is required.</ListError>
    </div>
  )
}

interface FieldCompositionRowProps {
  children?: ReactNode
  expanded?: boolean
  hasFold?: boolean
  icon?: ComponentType
  label: string
  meta?: ReactNode
  onToggle?: () => void
  typeName?: string
}

function FieldCompositionRow({
  children,
  expanded = false,
  hasFold = true,
  icon,
  label,
  meta,
  onToggle,
  typeName
}: FieldCompositionRowProps) {
  return (
    <ListRow role="listitem">
      <ListRowHeader
        aria-label={`${label} block`}
        draggable
        expanded={hasFold && expanded}
        hasFold={hasFold}
        onDragStart={event => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', label)
        }}
        onToggle={hasFold ? onToggle : undefined}
      >
        <ListRowDrag>
          <ListRowBadges>
            {hasFold && (
              <ListRowFoldButton
                aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
                expanded={expanded}
                onPress={onToggle}
              />
            )}
            <ListRowType icon={icon} name={typeName}>
              {label}
            </ListRowType>
            {meta && <ListRowMeta>{meta}</ListRowMeta>}
          </ListRowBadges>
        </ListRowDrag>
        <ListRowActions>
          <Button
            appearance="plain"
            aria-label={`${label} settings`}
            icon={IcRoundMoreHoriz}
            size="icon-small"
          />
          <Button
            appearance="plain"
            aria-label={`Remove ${label}`}
            icon={IcRoundClose}
            size="icon-small"
          />
        </ListRowActions>
      </ListRowHeader>
      {expanded && children && <ListRowBody>{children}</ListRowBody>}
    </ListRow>
  )
}

function FieldCompositionCreateActions() {
  return (
    <TypeCreateActions
      items={[
        {id: 'text', label: 'Text', colorName: 'Text', icon: IcRoundEdit},
        {
          id: 'columns',
          label: 'Columns',
          colorName: 'Columns',
          icon: IcOutlineGridView
        },
        {
          id: 'programs',
          label: 'Programs',
          colorName: 'Programs',
          icon: IcRoundAccountTree
        },
        {id: 'image', label: 'Image', colorName: 'Image', icon: IcRoundImage},
        {
          id: 'archive',
          label: 'Archive',
          colorName: 'Archive',
          icon: IcRoundArchive
        }
      ]}
      label="More block types"
      onSelect={() => undefined}
    />
  )
}

export function FieldComposition() {
  const linkLabels = [
    'Opleidingen',
    'Management, Organisatie & Toerisme',
    'Gezondheid & Welzijn'
  ]
  const blockLabels = ['Intro', 'Columns']
  const nestedLabels = ['Ontdek onze opleidingen', 'Praktische informatie']
  const [expandedLinks, setExpandedLinks] = useState(new Set(linkLabels))
  const [expandedBlocks, setExpandedBlocks] = useState(new Set(blockLabels))
  const [expandedNested, setExpandedNested] = useState(new Set<string>())

  function toggleRow(
    label: string,
    setExpanded: (value: Set<string>) => void,
    expanded: Set<string>
  ) {
    const next = new Set(expanded)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    setExpanded(next)
  }

  return (
    <div className={styles.FieldComposition()}>
      <section className={styles.FieldComposition.section()}>
        <ListLabel
          aria-label={
            expandedLinks.size === linkLabels.length
              ? 'Collapse all links'
              : 'Expand all links'
          }
          count={3}
          description="Navigation links · with an internal-link settings example"
          expanded={expandedLinks.size === linkLabels.length}
          hasRows
          addLabel="Add link"
          onAdd={() => undefined}
          onPress={() =>
            setExpandedLinks(
              expandedLinks.size === linkLabels.length
                ? new Set()
                : new Set(linkLabels)
            )
          }
        >
          Links
        </ListLabel>
        <List aria-label="Links" data-depth="muted">
          <FieldCompositionRow
            hasFold={false}
            icon={IcRoundInsertDriveFile}
            label="Opleidingen"
            meta="Opleidingen#interes…"
            typeName="Page link"
            expanded={expandedLinks.has('Opleidingen')}
            onToggle={() =>
              toggleRow('Opleidingen', setExpandedLinks, expandedLinks)
            }
          />
          <FieldCompositionRow
            expanded={expandedLinks.has('Management, Organisatie & Toerisme')}
            icon={IcRoundLink}
            label="Management, Organisatie & Toerisme"
            meta="#a"
            typeName="External link"
            onToggle={() =>
              toggleRow(
                'Management, Organisatie & Toerisme',
                setExpandedLinks,
                expandedLinks
              )
            }
          >
            <div className={styles.FieldComposition.fields()}>
              <TextField
                label="Link text"
                value="Management, Organisatie & Toerisme"
              />
              <TextField label="URL" value="#a" />
            </div>
          </FieldCompositionRow>
          <FieldCompositionRow
            hasFold={false}
            icon={IcRoundLink}
            label="Gezondheid & Welzijn"
            meta="#b"
            typeName="External link"
            expanded={expandedLinks.has('Gezondheid & Welzijn')}
            onToggle={() =>
              toggleRow('Gezondheid & Welzijn', setExpandedLinks, expandedLinks)
            }
          />
        </List>
        <ListCreateRow>
          <ListCreateButton icon={IcRoundInsertDriveFile} name="Page link">
            Page link
          </ListCreateButton>
          <ListCreateButton icon={IcRoundLink} name="External link">
            External link
          </ListCreateButton>
          <ListCreateButton icon={IcRoundAttachFile} name="File">
            File
          </ListCreateButton>
        </ListCreateRow>
        <div className={styles.FieldComposition.empty()}>
          <ListLabel count={0} expanded={false} hasRows={false}>
            Empty list
          </ListLabel>
          <ListCreateRow empty>
            <ListCreateButton icon={IcRoundInsertDriveFile} name="Page link">
              Page link
            </ListCreateButton>
            <ListCreateButton icon={IcRoundLink} name="External link">
              External link
            </ListCreateButton>
            <ListCreateButton icon={IcRoundAttachFile} name="File">
              File
            </ListCreateButton>
          </ListCreateRow>
        </div>
      </section>
      <section className={styles.FieldComposition.section()}>
        <ListLabel
          aria-label={
            expandedBlocks.size === blockLabels.length
              ? 'Collapse all blocks'
              : 'Expand all blocks'
          }
          count={2}
          description="Sample composition · expand a row to edit"
          expanded={expandedBlocks.size === blockLabels.length}
          hasRows
          addLabel="Add block"
          onAdd={() => undefined}
          onPress={() =>
            setExpandedBlocks(
              expandedBlocks.size === blockLabels.length
                ? new Set()
                : new Set(blockLabels)
            )
          }
        >
          Blocks
        </ListLabel>
        <List aria-label="Blocks" data-depth="muted">
          <FieldCompositionRow
            expanded={expandedBlocks.has('Intro')}
            icon={IcRoundEdit}
            label="Intro"
            meta="Biomedical Laboratory…"
            typeName="Text"
            onToggle={() =>
              toggleRow('Intro', setExpandedBlocks, expandedBlocks)
            }
          >
            <div className={styles.FieldComposition.editor()}>
              Biomedical Laboratory Technology
            </div>
          </FieldCompositionRow>
          <FieldCompositionRow
            expanded={expandedBlocks.has('Columns')}
            icon={IcOutlineGridView}
            label="Columns"
            typeName="Columns"
            onToggle={() =>
              toggleRow('Columns', setExpandedBlocks, expandedBlocks)
            }
          >
            <ListLabel
              aria-label={
                expandedNested.size === nestedLabels.length
                  ? 'Collapse nested blocks'
                  : 'Expand nested blocks'
              }
              count={2}
              expanded={expandedNested.size === nestedLabels.length}
              hasRows
              addLabel="Add nested block"
              inline
              onAdd={() => undefined}
              onPress={() =>
                setExpandedNested(
                  expandedNested.size === nestedLabels.length
                    ? new Set()
                    : new Set(nestedLabels)
                )
              }
            >
              Blocks
            </ListLabel>
            <List aria-label="Nested blocks">
              <FieldCompositionRow
                icon={IcRoundEdit}
                label="Ontdek onze opleidingen"
                meta="Text"
                typeName="Text"
                expanded={expandedNested.has('Ontdek onze opleidingen')}
                onToggle={() =>
                  toggleRow(
                    'Ontdek onze opleidingen',
                    setExpandedNested,
                    expandedNested
                  )
                }
              />
              <FieldCompositionRow
                icon={IcOutlineGridView}
                label="Praktische informatie"
                meta="Columns"
                typeName="Columns"
                expanded={expandedNested.has('Praktische informatie')}
                onToggle={() =>
                  toggleRow(
                    'Praktische informatie',
                    setExpandedNested,
                    expandedNested
                  )
                }
              />
            </List>
            <ListCreateRow>
              <FieldCompositionCreateActions />
            </ListCreateRow>
          </FieldCompositionRow>
        </List>
        <ListCreateRow>
          <FieldCompositionCreateActions />
        </ListCreateRow>
      </section>
    </div>
  )
}

export function DragPreview() {
  return <ListDragPreview icon={IcRoundPanorama} label="Hero" />
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

function entryStatusTone(status: EntryStatus) {
  switch (status) {
    case 'published':
      return 'positive' as const
    case 'draft':
      return 'accent' as const
    case 'archived':
      return 'neutral' as const
  }
}

function queueStatusTone(status: QueueExample['status']) {
  switch (status) {
    case 'syncing':
      return 'accent' as const
    case 'pending':
    case 'blocked':
      return 'warning' as const
    case 'failed':
      return 'danger' as const
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
              onPress={() => undefined}
              leading={
                <ListItemVisual className={styles.SmallLists.visual()}>
                  <reference.icon data-slot="icon" />
                </ListItemVisual>
              }
              trailing={
                <span className={styles.SmallLists.trailing()}>
                  {reference.statuses.map(status => (
                    <ListItemStatus key={status} tone={entryStatusTone(status)}>
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
              onPress={() => undefined}
              leading={
                <ListItemVisual className={styles.SmallLists.visual()}>
                  <revision.icon data-slot="icon" />
                </ListItemVisual>
              }
              trailing={
                <ListItemStatus tone={entryStatusTone(revision.status)}>
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
                <ListItemStatus tone={queueStatusTone(entry.status)}>
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

export default {title: 'Components / List'}
