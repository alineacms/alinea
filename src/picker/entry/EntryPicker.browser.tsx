import {Picker, PickerProps, Root, WorkspaceData, createId} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {workspaceMediaDir} from 'alinea/core/EntryFilenames'
import {Reference} from 'alinea/core/Reference'
import {isMediaRoot} from 'alinea/core/media/MediaRoot'
import {and} from 'alinea/core/pages/Expr'
import {entries} from 'alinea/core/util/Objects'
import {useConfig} from 'alinea/dashboard/hook/UseConfig'
import {useFocusList} from 'alinea/dashboard/hook/UseFocusList'
import {useGraph} from 'alinea/dashboard/hook/UseGraph'
import {useLocale} from 'alinea/dashboard/hook/UseLocale'
import {useRoot} from 'alinea/dashboard/hook/UseRoot'
import {useWorkspace} from 'alinea/dashboard/hook/UseWorkspace'
import {Breadcrumbs, BreadcrumbsItem} from 'alinea/dashboard/view/Breadcrumbs'
import {IconButton} from 'alinea/dashboard/view/IconButton'
import {Modal} from 'alinea/dashboard/view/Modal'
import {Langswitch} from 'alinea/dashboard/view/entry/LangSwitch'
import {
  Explorer,
  ExporerItemSelect
} from 'alinea/dashboard/view/explorer/Explorer'
import {FileUploader} from 'alinea/dashboard/view/media/FileUploader'
import {
  Button,
  HStack,
  Icon,
  Loader,
  Stack,
  TextLabel,
  VStack,
  fromModule
} from 'alinea/ui'
import {Menu, MenuItem} from 'alinea/ui/Menu'
import {IcOutlineGridView} from 'alinea/ui/icons/IcOutlineGridView'
import {IcOutlineList} from 'alinea/ui/icons/IcOutlineList'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundSearch} from 'alinea/ui/icons/IcRoundSearch'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {Suspense, useCallback, useMemo, useState} from 'react'
import {useQuery} from 'react-query'
import {
  EntryPickerOptions,
  entryPicker as createEntryPicker
} from './EntryPicker.js'
import css from './EntryPicker.module.scss'
import {EntryPickerRow} from './EntryPickerRow.js'
import {EntryReference} from './EntryReference.js'

export * from './EntryPicker.js'

export const entryPicker = Picker.withView(createEntryPicker, {
  view: EntryPickerModal,
  viewRow: EntryPickerRow
})

interface PickerLocation {
  parentId?: string
  workspace: string
  root: string
  locale?: string
}

const styles = fromModule(css)

function mediaRoot(workspace: WorkspaceData & {name: string}): string {
  for (const [name, root] of entries(workspace.roots))
    if (isMediaRoot(root)) return name
  throw new Error(`Workspace ${workspace.name} has no media root`)
}

export interface EntryPickerModalProps
  extends PickerProps<EntryPickerOptions> {}

export function EntryPickerModal({
  type,
  options,
  selection,
  onConfirm,
  onCancel
}: EntryPickerModalProps) {
  const config = useConfig()
  const graph = useGraph()
  const {
    title,
    defaultView,
    max,
    condition,
    withNavigation = true,
    showMedia
  } = options
  const [search, setSearch] = useState('')
  const list = useFocusList({
    onClear: () => setSearch('')
  })
  const [selected, setSelected] = useState<Array<Reference>>(
    () => selection || []
  )
  const workspace = useWorkspace()
  const {name: root} = useRoot()
  const locale = useLocale()
  const [destination, setDestination] = useState<PickerLocation>({
    workspace: workspace.name,
    root: showMedia ? mediaRoot(workspace) : root,
    locale: locale
  })
  const destinationRoot = Root.data(workspace.roots[destination.root])
  const destinationLocale = !destinationRoot.i18n
    ? undefined
    : destination.locale ?? destinationRoot.i18n.locales[0]
  const {data: parentEntries} = useQuery(
    ['picker-parents', destination, destinationLocale],
    async () => {
      if (!destination.parentId) return []
      const drafts = graph.preferDraft
      const query = destinationLocale
        ? drafts.locale(destinationLocale)
        : drafts
      const res = await query.get(
        Entry({entryId: destination.parentId}).select({
          title: Entry.title,
          parents({parents}) {
            return parents().select({
              id: Entry.entryId,
              title: Entry.title
            })
          }
        })
      )
      return res?.parents.concat({
        id: destination.parentId,
        title: res.title
      })
    }
  )
  const cursor = useMemo(() => {
    const terms = search.replace(/,/g, ' ').split(' ').filter(Boolean)
    if (!withNavigation && condition)
      return Entry()
        .where(condition)
        .search(...terms)
    const rootCondition = and(
      Entry.workspace.is(destination.workspace),
      Entry.root.is(destination.root)
    )
    const destinationCondition =
      terms.length === 0
        ? and(rootCondition, Entry.parent.is(destination.parentId ?? null))
        : rootCondition
    const translatedCondition = destinationLocale
      ? and(destinationCondition, Entry.locale.is(destinationLocale))
      : destinationCondition
    return Entry()
      .where(translatedCondition)
      .search(...terms)
  }, [destination, destinationLocale, search, condition])
  const [view, setView] = useState<'row' | 'thumb'>(defaultView || 'row')
  const handleSelect = useCallback(
    (entry: ExporerItemSelect) => {
      setSelected(selected => {
        const index = selected.findIndex(
          ref =>
            EntryReference.isEntryReference(ref) && ref.entry === entry.entryId
        )
        let res = selected.slice()
        if (index === -1) {
          res = res
            .concat({
              id: createId(),
              type,
              entry: entry.entryId
            } as EntryReference)
            .slice(-(max || 0))
        } else {
          res.splice(index, 1)
          res = res.slice(-(max || 0))
        }
        // Special case: if we're expecting a single reference we'll confirm
        // upon selection
        if (max === 1 && res.length === 1) onConfirm(res)
        return res
      })
    },
    [setSelected, max]
  )
  function handleConfirm() {
    onConfirm(selected)
  }

  function toRoot() {
    setDestination({...destination, parentId: undefined})
  }

  function goUp() {
    if (!destination.parentId) return onCancel()
    const parentIndex = parentEntries?.findIndex(
      ({id}) => id === destination.parentId
    )
    if (parentIndex === undefined) return
    const parent = parentEntries?.[parentIndex - 1]
    if (!parent) return toRoot()
    setDestination({...destination, parentId: parent.id})
  }

  return (
    <Modal open onClose={onCancel} className={styles.root()}>
      <Suspense fallback={<Loader absolute />}>
        <div className={styles.root.header()}>
          <VStack gap={24}>
            <HStack align="flex-end" gap={18}>
              <IconButton icon={IcRoundArrowBack} onClick={goUp} />
              <VStack>
                {withNavigation && (
                  <Breadcrumbs>
                    <BreadcrumbsItem>
                      <button onClick={toRoot}>{workspace.label}</button>
                    </BreadcrumbsItem>
                    <BreadcrumbsItem>
                      <Menu
                        onAction={name => {
                          setDestination({
                            workspace: destination.workspace,
                            root: name as string
                          })
                        }}
                        label={
                          <HStack center gap={4}>
                            {Root.label(workspace.roots[destination.root])}
                            <Icon icon={IcRoundUnfoldMore} />
                          </HStack>
                        }
                      >
                        {entries(workspace.roots).map(([name, root]) => {
                          return (
                            <MenuItem key={name} id={name}>
                              {Root.label(root)}
                            </MenuItem>
                          )
                        })}
                      </Menu>
                      {destinationRoot.i18n && (
                        <Langswitch
                          inline
                          selected={destinationLocale!}
                          locales={destinationRoot.i18n.locales}
                          onChange={locale => {
                            setDestination({
                              ...destination,
                              parentId: undefined,
                              locale
                            })
                          }}
                        />
                      )}
                    </BreadcrumbsItem>
                    {!search &&
                      parentEntries?.map(({id, title}) => {
                        return (
                          <BreadcrumbsItem key={id}>
                            <button
                              onClick={() => {
                                setDestination({...destination, parentId: id})
                              }}
                            >
                              {title}
                            </button>
                          </BreadcrumbsItem>
                        )
                      })}
                  </Breadcrumbs>
                )}
                <h2>
                  {title ? <TextLabel label={title} /> : 'Select a reference'}
                </h2>
              </VStack>
            </HStack>

            <label className={styles.root.search()}>
              <IcRoundSearch className={styles.root.search.icon()} />
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                className={styles.root.search.input()}
                {...list.focusProps}
                autoFocus
              />
              <Stack.Right>
                <HStack gap={16}>
                  <IconButton
                    icon={IcOutlineList}
                    active={view === 'row'}
                    onClick={() => setView('row')}
                  />
                  <IconButton
                    icon={IcOutlineGridView}
                    active={view === 'thumb'}
                    onClick={() => setView('thumb')}
                  />
                </HStack>
              </Stack.Right>
            </label>
          </VStack>
        </div>
        <VStack style={{flexGrow: 1, minHeight: 0}}>
          <list.Container>
            <div className={styles.root.results()}>
              <Explorer
                virtualized
                cursor={cursor}
                type={view}
                selectable={showMedia ? ['MediaFile'] : true}
                selection={selected}
                toggleSelect={handleSelect}
                showMedia={showMedia}
                onNavigate={
                  search
                    ? undefined
                    : entryId => {
                        setDestination({...destination, parentId: entryId})
                      }
                }
                withNavigation={withNavigation}
              />
            </div>
          </list.Container>
          {showMedia && (
            <FileUploader
              position="left"
              destination={{
                ...destination,
                directory: workspaceMediaDir(config, destination.workspace)
              }}
              max={max}
              toggleSelect={handleSelect}
            />
          )}
        </VStack>
        <HStack as="footer" className={styles.root.footer()}>
          <Stack.Right>
            <HStack gap={16}>
              <Button outline type="button" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>Confirm</Button>
            </HStack>
          </Stack.Right>
        </HStack>
      </Suspense>
    </Modal>
  )
}
