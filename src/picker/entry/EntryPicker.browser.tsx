import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import {QueryWithResult} from 'alinea/core/Graph'
import {createId} from 'alinea/core/Id'
import {PickerProps, pickerWithView} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {workspaceMediaDir} from 'alinea/core/util/EntryFilenames'
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
import {Button, HStack, Icon, Loader, Stack, TextLabel, VStack} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
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

export const entryPicker = pickerWithView(createEntryPicker, {
  view: EntryPickerModal,
  viewRow: EntryPickerRow
})

interface PickerLocation {
  parentId?: string
  workspace: string
  root: string
  locale?: string
}

const styles = styler(css)

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
    location,
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
  const {name: currentWorkspace} = useWorkspace()
  const {name: currentRoot} = useRoot()
  const locale = useLocale()
  const [destination, setDestination] = useState<PickerLocation>({
    workspace: currentWorkspace,
    root: showMedia
      ? Workspace.defaultMediaRoot(config.workspaces[currentWorkspace])
      : currentRoot,
    ...location,
    locale: locale
  })
  const workspace = config.workspaces[destination.workspace]
  const workspaceData = Workspace.data(workspace)
  const updateDestination = useCallback(
    (update: PickerLocation) => {
      setDestination(current => ({...update, ...location}))
    },
    [location, setDestination]
  )
  const destinationRoot = Root.data(workspace[destination.root])
  const locales = destinationRoot.i18n?.locales
  const destinationLocale = !destinationRoot.i18n
    ? undefined
    : locales && destination.locale && locales.includes(destination.locale)
    ? destination.locale
    : destinationRoot.i18n.locales[0]
  const {data: parentEntries} = useQuery(
    ['picker-parents', destination, destinationLocale],
    async () => {
      if (!destination.parentId) return []
      const res = await graph.get({
        locale: destinationLocale,
        select: {
          title: Entry.title,
          parents: {
            parents: {},
            select: {
              id: Entry.entryId,
              title: Entry.title
            }
          }
        },
        filter: {
          _id: destination.parentId
        },
        status: 'preferDraft'
      })
      return res?.parents.concat({
        id: destination.parentId,
        title: res.title
      })
    }
  )
  const query = useMemo((): QueryWithResult<ExporerItemSelect> => {
    const terms = search.replace(/,/g, ' ').split(' ').filter(Boolean)
    if (!withNavigation && condition) {
      return {
        select: Entry,
        search: terms,
        filter: {
          and: [
            condition,
            {
              _workspace: destination.workspace,
              _root: destination.root,
              _locale: destinationLocale
            }
          ]
        }
      }
    }
    return {
      select: Entry,
      filter: {
        and: [
          condition,
          {
            _workspace: destination.workspace,
            _root: destination.root,
            _parent:
              terms.length === 0 ? destination.parentId ?? null : undefined,
            _locale: destinationLocale
          }
        ]
      },
      search: terms
    }
  }, [destination, destinationLocale, search, condition])
  const [view, setView] = useState<'row' | 'thumb'>(defaultView || 'row')
  const handleSelect = useCallback(
    (entry: ExporerItemSelect) => {
      setSelected(selected => {
        const index = selected.findIndex(
          ref =>
            EntryReference.isEntryReference(ref) &&
            ref[EntryReference.entry] === entry.entryId
        )
        let res = selected.slice()
        if (index === -1) {
          res = res
            .concat({
              [Reference.id]: createId(),
              [Reference.type]: type,
              [EntryReference.entry]: entry.entryId
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
    updateDestination({...destination, parentId: undefined})
  }

  function goUp() {
    if (!destination.parentId) return onCancel()
    const parentIndex = parentEntries?.findIndex(
      ({id}) => id === destination.parentId
    )
    if (parentIndex === undefined) return
    const parent = parentEntries?.[parentIndex - 1]
    if (!parent) return toRoot()
    updateDestination({...destination, parentId: parent.id})
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
                      <button onClick={toRoot}>{workspaceData.label}</button>
                    </BreadcrumbsItem>
                    <BreadcrumbsItem>
                      {location ? (
                        Root.label(workspace[destination.root])
                      ) : (
                        <DropdownMenu.Root bottom>
                          <DropdownMenu.Trigger>
                            <HStack center gap={4}>
                              {Root.label(workspace[destination.root])}
                              <Icon icon={IcRoundUnfoldMore} />
                            </HStack>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Items>
                            {entries(workspace).map(([name, root]) => {
                              return (
                                <DropdownMenu.Item
                                  key={name}
                                  onClick={() => {
                                    updateDestination({
                                      workspace: destination.workspace,
                                      root: name
                                    })
                                  }}
                                >
                                  {Root.label(root)}
                                </DropdownMenu.Item>
                              )
                            })}
                          </DropdownMenu.Items>
                        </DropdownMenu.Root>
                      )}
                      {destinationRoot.i18n && (
                        <Langswitch
                          inline
                          selected={destinationLocale!}
                          locales={destinationRoot.i18n.locales}
                          onChange={locale => {
                            updateDestination({
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
                                updateDestination({
                                  ...destination,
                                  parentId: id
                                })
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
                query={query}
                type={view}
                selectable={showMedia ? ['MediaFile'] : true}
                selection={selected}
                toggleSelect={handleSelect}
                showMedia={showMedia}
                onNavigate={
                  search && !showMedia
                    ? undefined
                    : entryId => {
                        if (showMedia && search) {
                          setSearch('')
                        }
                        updateDestination({...destination, parentId: entryId})
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
