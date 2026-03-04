import {Button, Icon, ProgressCircle} from '@alinea/components'
import styler from '@alinea/styler'
import type {Config} from 'alinea/core/Config'
import {Entry, type EntryStatus} from 'alinea/core/Entry'
import {getType} from 'alinea/core/Internal'
import type {OrderBy} from 'alinea/core/OrderBy'
import {Root} from 'alinea/core/Root'
import type {Schema} from 'alinea/core/Schema'
import {Type} from 'alinea/core/Type'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {summarySelection} from 'alinea/core/media/Summary'
import {
  Collection,
  GridLayout,
  GridList,
  GridListItem,
  GridListLoadMoreItem,
  ListBox,
  ListBoxItem,
  ListBoxLoadMoreItem,
  ListLayout,
  Virtualizer
} from 'react-aria-components'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
  IcOutlineGridView,
  IcOutlineTableRows,
  IcRoundDescription,
  IcRoundInsertDriveFile,
  IcTwotoneFolder
} from '../icons.js'
import {EntryStatus as EntryStatusBadge} from './EntryStatus.js'
import css from './ContentExplorer.module.css'

const styles = styler(css)

type ExplorerMode = 'rows' | 'cards'

interface ExplorerParent {
  id: string
  title: string
}

interface ExplorerQueryRow {
  id: string
  title: string
  type: string
  path: string
  status: EntryStatus
  main: boolean
  locale: string | null
  extension?: string
  size?: number
  preview?: string
  width?: number
  height?: number
  parents: Array<ExplorerParent>
  childrenAmount: number
}

interface ExplorerEntry {
  id: string
  title: string
  type: string
  path: string
  status: EntryStatus
  isUnpublished: boolean
  locale: string | null
  extension?: string
  size?: number
  preview?: string
  width?: number
  height?: number
  parents: Array<ExplorerParent>
  childrenAmount: number
}

interface ExplorerScope {
  key: string
  workspace: string
  root: string
  parentId: string | null
  parentTitle: string
  locale?: string
  typeNames: Array<string>
  orderBy?: OrderBy | Array<OrderBy>
}

interface ExplorerBaseQuery {
  workspace: string
  root: string
  parentId: string | null
  filter: {
    _type: {
      in: Array<string>
    }
  }
  status: 'preferDraft'
  locale?: string
  orderBy?: OrderBy | Array<OrderBy>
}

interface ContentExplorerState {
  scope: ExplorerScope | null
  entries: Array<ExplorerEntry>
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  errorMessage?: string
}

interface ScopeParentEntry {
  id: string
  title: string
  type: string
}

interface ContentExplorerProps {
  graph: WriteableGraph
  config: Config
  workspace?: string
  root?: string
  entry?: string
  locale?: string
  pageSize?: number
  autoLoadMore?: boolean
  virtualized?: boolean
  defaultMode?: ExplorerMode
  onOpenEntry: (entryId: string) => void
}

const rowLayoutOptions = {
  rowHeight: 70,
  padding: 0,
  gap: 1,
  loaderHeight: 42
}

function entrySelection(schema: Schema) {
  return {
    ...summarySelection(schema),
    status: Entry.status,
    main: Entry.main,
    locale: Entry.locale
  }
}

function visibleTypeNames(config: Config): Array<string> {
  return Object.entries(config.schema)
    .filter(([name, type]) => name === 'MediaFile' || !Type.isHidden(type))
    .map(([name]) => name)
}

function buildBaseQuery(scope: ExplorerScope): ExplorerBaseQuery {
  return {
    workspace: scope.workspace,
    root: scope.root,
    parentId: scope.parentId,
    orderBy: scope.orderBy,
    filter: {_type: {in: scope.typeNames}},
    status: 'preferDraft',
    locale: scope.locale
  }
}

function mapQueryRow(row: ExplorerQueryRow): ExplorerEntry {
  return {
    id: row.id,
    title: row.title || '(Untitled)',
    type: row.type,
    path: row.path,
    status: row.status,
    isUnpublished: row.status === 'draft' && row.main,
    locale: row.locale,
    extension: row.extension || undefined,
    size: row.size,
    preview: row.preview || undefined,
    width: row.width,
    height: row.height,
    parents: row.parents,
    childrenAmount: row.childrenAmount || 0
  }
}

function extensionLabel(extension?: string): string | null {
  if (!extension) return null
  const normalized = extension.startsWith('.') ? extension.slice(1) : extension
  return normalized ? normalized.toUpperCase() : null
}

function formatBytes(size?: number): string | null {
  if (!size || size <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}

function mediaInfo(entry: ExplorerEntry): string | null {
  const parts: Array<string> = []
  const extension = extensionLabel(entry.extension)
  const byteSize = formatBytes(entry.size)

  if (extension) parts.push(extension)
  if (entry.width && entry.height) parts.push(`${entry.width}x${entry.height}`)
  if (byteSize) parts.push(byteSize)

  return parts.length ? parts.join(' | ') : null
}

function parentPath(entry: ExplorerEntry): string | null {
  if (!entry.parents.length) return null
  return entry.parents.map(parent => parent.title).join(' / ')
}

function fallbackIcon(entry: ExplorerEntry) {
  if (entry.childrenAmount > 0) return IcTwotoneFolder
  if (entry.extension) return IcRoundInsertDriveFile
  return IcRoundDescription
}

function buildTypeLabels(config: Config): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const [name, type] of Object.entries(config.schema)) {
    labels[name] = String(Type.label(type))
  }
  return labels
}

function entryTypeLabel(
  typeLabels: Record<string, string>,
  typeName: string
): string {
  return typeLabels[typeName] || typeName
}

async function findScopeParentEntry(
  graph: WriteableGraph,
  workspace: string,
  root: string,
  entry: string,
  locale: string | undefined
): Promise<ScopeParentEntry | null> {
  const byId = await graph.first({
    workspace,
    root,
    id: entry,
    locale,
    select: {
      id: Entry.id,
      title: Entry.title,
      type: Entry.type
    },
    status: 'preferDraft'
  })
  if (byId) return byId
  return await graph.first({
    workspace,
    root,
    path: entry,
    locale,
    select: {
      id: Entry.id,
      title: Entry.title,
      type: Entry.type
    },
    status: 'preferDraft'
  })
}

async function resolveScope(
  graph: WriteableGraph,
  config: Config,
  workspace: string | undefined,
  root: string | undefined,
  entry: string | undefined,
  locale: string | undefined
): Promise<ExplorerScope | null> {
  if (!workspace || !root) return null

  const workspaceConfig = config.workspaces[workspace]
  if (!workspaceConfig) return null

  const rootConfig = workspaceConfig[root]
  if (!rootConfig) return null

  const typeNames = visibleTypeNames(config)
  const rootData = Root.data(rootConfig)
  const rootLocales = rootData.i18n?.locales ?? []
  const scopedLocale =
    rootLocales.length > 0
      ? rootLocales.includes(locale || '')
        ? locale
        : rootLocales[0]
      : undefined

  let parentId: string | null = null
  let parentTitle = String(Root.label(rootConfig))
  let orderBy = rootData.orderChildrenBy

  if (entry) {
    const parentEntry = await findScopeParentEntry(
      graph,
      workspace,
      root,
      entry,
      scopedLocale
    )
    if (parentEntry) {
      parentId = parentEntry.id
      parentTitle = parentEntry.title || '(Untitled)'
      const parentType = config.schema[parentEntry.type]
      if (parentType) {
        const typeData = getType(parentType)
        orderBy = typeData.orderChildrenBy
      }
    }
  }

  return {
    key: [workspace, root, parentId || 'root', scopedLocale || '-'].join(':'),
    workspace,
    root,
    parentId,
    parentTitle,
    locale: scopedLocale,
    typeNames,
    orderBy
  }
}

async function queryTotal(
  graph: WriteableGraph,
  scope: ExplorerScope
): Promise<number> {
  return await graph.count(buildBaseQuery(scope))
}

async function queryPage(
  graph: WriteableGraph,
  config: Config,
  scope: ExplorerScope,
  skip: number,
  take: number
): Promise<Array<ExplorerEntry>> {
  const rows = (await graph.find({
    ...buildBaseQuery(scope),
    skip,
    take,
    select: entrySelection(config.schema)
  })) as Array<ExplorerQueryRow>

  return rows.map(row => mapQueryRow(row))
}

interface RowItemProps {
  entry: ExplorerEntry
  typeLabel: string
}

function RowItem({entry, typeLabel}: RowItemProps) {
  const parentTrail = parentPath(entry)
  const details = mediaInfo(entry)

  return (
    <div className={styles.row()}>
      <div className={styles.thumb()}>
        {entry.preview ? (
          <img
            alt=""
            src={entry.preview}
            className={styles.thumbImage()}
          />
        ) : (
          <Icon icon={fallbackIcon(entry)} />
        )}
      </div>

      <div className={styles.rowMain()}>
        {parentTrail && <div className={styles.parents()}>{parentTrail}</div>}
        <div className={styles.title()}>{entry.title}</div>
      </div>

      <div className={styles.rowMeta()}>
        {details && <span className={styles.detail()}>{details}</span>}
        {entry.childrenAmount > 0 && (
          <span className={styles.detail()}>{entry.childrenAmount} children</span>
        )}
        <span className={styles.type()}>{typeLabel}</span>
        <EntryStatusBadge
          status={entry.status}
          isUnpublished={entry.isUnpublished}
        />
      </div>
    </div>
  )
}

interface CardItemProps {
  entry: ExplorerEntry
  typeLabel: string
}

function CardItem({entry, typeLabel}: CardItemProps) {
  const parentTrail = parentPath(entry)
  const details = mediaInfo(entry)

  return (
    <div className={styles.card()}>
      <div className={styles.cardPreview()}>
        {entry.preview ? (
          <img
            alt=""
            src={entry.preview}
            className={styles.cardPreviewImage()}
          />
        ) : (
          <Icon
            icon={fallbackIcon(entry)}
            className={styles.cardIcon()}
          />
        )}
      </div>

      <div className={styles.cardBody()}>
        {parentTrail && <div className={styles.parents()}>{parentTrail}</div>}
        <div className={styles.cardTitle()}>{entry.title}</div>

        <div className={styles.cardFooter()}>
          <span className={styles.type()}>{typeLabel}</span>
          <EntryStatusBadge
            status={entry.status}
            isUnpublished={entry.isUnpublished}
          />
        </div>

        {(details || entry.childrenAmount > 0) && (
          <div className={styles.detail()}>
            {details}
            {details && entry.childrenAmount > 0 ? ' | ' : ''}
            {entry.childrenAmount > 0 ? `${entry.childrenAmount} children` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export function ContentExplorer({
  graph,
  config,
  workspace,
  root,
  entry,
  locale,
  pageSize = 60,
  autoLoadMore = true,
  virtualized = true,
  defaultMode = 'rows',
  onOpenEntry
}: ContentExplorerProps) {
  const [mode, setMode] = useState<ExplorerMode>(defaultMode)
  const [state, setState] = useState<ContentExplorerState>({
    scope: null,
    entries: [],
    total: 0,
    isLoading: true,
    isLoadingMore: false
  })
  const requestIdRef = useRef(0)
  const stateRef = useRef(state)
  const loadingMoreRef = useRef(false)
  const typeLabels = useMemo(() => buildTypeLabels(config), [config])

  useEffect(
    function syncStateRef() {
      stateRef.current = state
    },
    [state]
  )

  const loadMore = useCallback(
    async function loadMore() {
      if (loadingMoreRef.current) return
      const current = stateRef.current
      if (!current.scope || current.isLoading || current.isLoadingMore) return
      if (current.entries.length >= current.total) return

      loadingMoreRef.current = true
      const requestId = requestIdRef.current
      setState(prev => ({...prev, isLoadingMore: true}))

      try {
        const nextEntries = await queryPage(
          graph,
          config,
          current.scope,
          current.entries.length,
          pageSize
        )
        if (requestId !== requestIdRef.current) return
        setState(prev => ({
          ...prev,
          entries: [...prev.entries, ...nextEntries],
          isLoadingMore: false
        }))
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        const message = error instanceof Error ? error.message : 'Failed to load.'
        setState(prev => ({
          ...prev,
          isLoadingMore: false,
          errorMessage: message
        }))
      } finally {
        loadingMoreRef.current = false
      }
    },
    [config, graph, pageSize]
  )

  useEffect(
    function loadScopeAndFirstPage() {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      loadingMoreRef.current = false

      setState({
        scope: null,
        entries: [],
        total: 0,
        isLoading: true,
        isLoadingMore: false
      })

      async function run() {
        try {
          const scope = await resolveScope(
            graph,
            config,
            workspace,
            root,
            entry,
            locale
          )
          if (requestId !== requestIdRef.current) return
          if (!scope) {
            setState({
              scope: null,
              entries: [],
              total: 0,
              isLoading: false,
              isLoadingMore: false
            })
            return
          }
          if (scope.typeNames.length === 0) {
            setState({
              scope,
              entries: [],
              total: 0,
              isLoading: false,
              isLoadingMore: false
            })
            return
          }

          const total = await queryTotal(graph, scope)
          if (requestId !== requestIdRef.current) return

          const entries =
            total > 0 ? await queryPage(graph, config, scope, 0, pageSize) : []
          if (requestId !== requestIdRef.current) return

          setState({
            scope,
            entries,
            total,
            isLoading: false,
            isLoadingMore: false
          })
        } catch (error) {
          if (requestId !== requestIdRef.current) return
          const message =
            error instanceof Error ? error.message : 'Failed to load entries.'
          setState({
            scope: null,
            entries: [],
            total: 0,
            isLoading: false,
            isLoadingMore: false,
            errorMessage: message
          })
        }
      }

      void run()
    },
    [config, entry, graph, locale, pageSize, root, workspace]
  )

  const hasMore = state.entries.length < state.total
  const scopeTitle = state.scope?.parentTitle || 'Entries'

  return (
    <section className={styles.root()}>
      <header className={styles.header()}>
        <div className={styles.headerText()}>
          <h2 className={styles.heading()}>{scopeTitle}</h2>
          <p className={styles.meta()}>
            Loaded {state.entries.length} of {state.total}
          </p>
        </div>

        <div className={styles.viewSwitch()}>
          <Button
            size="icon"
            appearance={mode === 'rows' ? 'active' : 'plain'}
            aria-label="Rows view"
            onPress={function onPress() {
              setMode('rows')
            }}
          >
            <Icon icon={IcOutlineTableRows} />
          </Button>
          <Button
            size="icon"
            appearance={mode === 'cards' ? 'active' : 'plain'}
            aria-label="Cards view"
            onPress={function onPress() {
              setMode('cards')
            }}
          >
            <Icon icon={IcOutlineGridView} />
          </Button>
        </div>
      </header>

      <div className={styles.viewport()}>
        {state.isLoading ? (
          <div className={styles.state()}>
            <ProgressCircle
              aria-label="Loading entries"
              isIndeterminate
            />
          </div>
        ) : state.errorMessage ? (
          <div className={styles.state()}>{state.errorMessage}</div>
        ) : !state.scope ? (
          <div className={styles.state()}>Select a root to explore entries.</div>
        ) : state.total === 0 ? (
          <div className={styles.state()}>No entries in this location.</div>
        ) : mode === 'rows' ? (
          virtualized ? (
            <Virtualizer
              layout={ListLayout}
              layoutOptions={rowLayoutOptions}
            >
              <ListBox
                aria-label="Children as rows"
                selectionMode="none"
                className={styles.listbox()}
                style={{display: 'block', height: '100%'}}
              >
                <Collection items={state.entries}>
                  {function renderListItem(entry) {
                    const typeLabel = entryTypeLabel(typeLabels, entry.type)
                    return (
                      <ListBoxItem
                        id={entry.id}
                        textValue={entry.title}
                        className={styles.rowItem()}
                        onAction={function onAction() {
                          onOpenEntry(entry.id)
                        }}
                      >
                        <RowItem
                          entry={entry}
                          typeLabel={typeLabel}
                        />
                      </ListBoxItem>
                    )
                  }}
                </Collection>
                {autoLoadMore && hasMore && (
                  <ListBoxLoadMoreItem
                    className={styles.loadMoreSentinel()}
                    onLoadMore={function onLoadMore() {
                      void loadMore()
                    }}
                    isLoading={state.isLoadingMore}
                  />
                )}
              </ListBox>
            </Virtualizer>
          ) : (
            <ListBox
              aria-label="Children as rows"
              selectionMode="none"
              className={styles.listbox()}
            >
              <Collection items={state.entries}>
                {function renderListItem(entry) {
                  const typeLabel = entryTypeLabel(typeLabels, entry.type)
                  return (
                    <ListBoxItem
                      id={entry.id}
                      textValue={entry.title}
                      className={styles.rowItem()}
                      onAction={function onAction() {
                        onOpenEntry(entry.id)
                      }}
                    >
                      <RowItem
                        entry={entry}
                        typeLabel={typeLabel}
                      />
                    </ListBoxItem>
                  )
                }}
              </Collection>
            </ListBox>
          )
        ) : virtualized ? (
          <Virtualizer
            layout={GridLayout}
          >
            <GridList
              aria-label="Children as cards"
              selectionMode="none"
              className={styles.grid()}
              style={{display: 'block', height: '100%'}}
            >
              <Collection items={state.entries}>
                {function renderGridItem(entry) {
                  const typeLabel = entryTypeLabel(typeLabels, entry.type)
                  return (
                    <GridListItem
                      id={entry.id}
                      textValue={entry.title}
                      className={styles.gridItem()}
                      onAction={function onAction() {
                        onOpenEntry(entry.id)
                      }}
                    >
                      <CardItem
                        entry={entry}
                        typeLabel={typeLabel}
                      />
                    </GridListItem>
                  )
                }}
              </Collection>
              {autoLoadMore && hasMore && (
                <GridListLoadMoreItem
                  className={styles.loadMoreSentinel()}
                  onLoadMore={function onLoadMore() {
                    void loadMore()
                  }}
                  isLoading={state.isLoadingMore}
                />
              )}
            </GridList>
          </Virtualizer>
        ) : (
          <GridList
            aria-label="Children as cards"
            selectionMode="none"
            className={styles.grid()}
          >
            <Collection items={state.entries}>
              {function renderGridItem(entry) {
                const typeLabel = entryTypeLabel(typeLabels, entry.type)
                return (
                  <GridListItem
                    id={entry.id}
                    textValue={entry.title}
                    className={styles.gridItem()}
                    onAction={function onAction() {
                      onOpenEntry(entry.id)
                    }}
                  >
                    <CardItem
                      entry={entry}
                      typeLabel={typeLabel}
                    />
                  </GridListItem>
                )
              }}
            </Collection>
          </GridList>
        )}
      </div>

      {hasMore && (
        <footer className={styles.footer()}>
          <Button
            size="small"
            appearance="plain"
            isDisabled={state.isLoadingMore}
            onPress={function onPress() {
              void loadMore()
            }}
          >
            {state.isLoadingMore ? 'Loading...' : 'Load more entries'}
          </Button>
        </footer>
      )}
    </section>
  )
}
