import styler from '@alinea/styler'
import {Entry} from '#/core/Entry.js'
import type {QueryWithResult} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import {type PickerProps, pickerWithView} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {Root} from '#/core/Root.js'
import {Workspace} from '#/core/Workspace.js'
import {workspaceMediaDir} from '#/core/util/EntryFilenames.js'
import {entries} from '#/core/util/Objects.js'
import {useConfig} from '#/dashboard/hook/UseConfig.js'
import {useEntryEditor} from '#/dashboard/hook/UseEntryEditor.js'
import {useFocusList} from '#/dashboard/hook/UseFocusList.js'
import {useGraph} from '#/dashboard/hook/UseGraph.js'
import {useLocale} from '#/dashboard/hook/UseLocale.js'
import {useRoot} from '#/dashboard/hook/UseRoot.js'
import {useWorkspace} from '#/dashboard/hook/UseWorkspace.js'
import {Breadcrumbs, BreadcrumbsItem} from '#/dashboard/view/Breadcrumbs.js'
import {IconButton} from '#/dashboard/view/IconButton.js'
import {Modal} from '#/dashboard/view/Modal.js'
import {Langswitch} from '#/dashboard/view/entry/LangSwitch.js'
import {
  Explorer,
  type ExporerItemSelect
} from '#/dashboard/view/explorer/Explorer.js'
import {FileUploader} from '#/dashboard/view/media/FileUploader.js'
import {Button, HStack, Icon, Loader, Stack, TextLabel, VStack} from '#/ui.js'
import {DropdownMenu} from '#/ui/DropdownMenu.js'
import {IcOutlineGridView} from '#/ui/icons/IcOutlineGridView.js'
import {IcOutlineList} from '#/ui/icons/IcOutlineList.js'
import {IcRoundArrowBack} from '#/ui/icons/IcRoundArrowBack.js'
import {IcRoundSearch} from '#/ui/icons/IcRoundSearch.js'
import {IcRoundUnfoldMore} from '#/ui/icons/IcRoundUnfoldMore.js'
import {Suspense, useCallback, useMemo, useState} from 'react'
import {useQuery} from 'react-query'
import {
  type EditorInfo,
  type EntryPickerOptions,
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
  locale?: string | null
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
  const editor = useEntryEditor()
  const {title, defaultView, max, pickChildren, showMedia} = options
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
  const entry = useMemo((): EditorInfo['entry'] | undefined => {
    if (!editor) return
    const {id, type, workspace, root, parentId, locale} = editor.activeVersion
    return {id, type, workspace, root, parentId, locale}
  }, [editor?.activeVersion])
  const locationQuery = useQuery(
    ['entry-location', graph, entry, options.location],
    async () => {
      if (!entry) return undefined
      return typeof options.location === 'function'
        ? options.location({graph, entry})
        : options.location
    },
    {suspense: true}
  )
  const location = locationQuery.data
  const [destination, setDestination] = useState<PickerLocation>({
    workspace: currentWorkspace,
    parentId: pickChildren ? editor?.entryId : undefined,
    root: showMedia
      ? Workspace.defaultMediaRoot(config.workspaces[currentWorkspace])
      : currentRoot,
    ...location,
    locale: locale
  })
  const workspace = config.workspaces[destination.workspace]
  const workspaceData = Workspace.data(workspace)
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
            edge: 'parents',
            select: {
              id: Entry.id,
              title: Entry.title
            }
          }
        },
        id: destination.parentId,
        status: 'preferDraft'
      })
      return res?.parents.concat({
        id: destination.parentId,
        title: res.title
      })
    }
  )
  const withNavigation =
    options.enableNavigation || (!options.condition && !options.pickChildren)
  const conditionQuery = useQuery(
    ['entry-condition', graph, entry],
    () => {
      if (!entry) return undefined
      return typeof options.condition === 'function'
        ? options.condition({graph, entry})
        : options.condition
    },
    {suspense: true}
  )
  const query = useMemo((): QueryWithResult<ExporerItemSelect> => {
    const terms = search.replace(/,/g, ' ').split(' ').filter(Boolean)
    const condition = conditionQuery.data
    const parentId =
      (withNavigation && !search) || pickChildren
        ? (destination.parentId ?? null)
        : undefined
    const filter = {
      and: [
        condition,
        {
          _workspace: destination.workspace,
          _root: destination.root,
          _parentId: parentId,
          _locale: destinationLocale
        }
      ]
    }
    return {
      select: Entry,
      filter: filter,
      search: terms
    }
  }, [
    withNavigation,
    destination,
    destinationLocale,
    search,
    conditionQuery.data
  ])
  const [view, setView] = useState<'row' | 'thumb'>(defaultView || 'row')
  const handleSelect = useCallback(
    (entry: ExporerItemSelect) => {
      setSelected(selected => {
        const index = selected.findIndex(
          ref =>
            EntryReference.isEntryReference(ref) &&
            ref[EntryReference.entry] === entry.id
        )
        let res = selected.slice()
        if (index === -1) {
          res = res
            .concat({
              [Reference.id]: createId(),
              [Reference.type]: type,
              [EntryReference.entry]: entry.id
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
    [onConfirm, type, max]
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
                      <button
                        type="button"
                        style={{cursor: 'pointer'}}
                        onClick={toRoot}
                      >
                        {workspaceData.label}
                      </button>
                    </BreadcrumbsItem>
                    <BreadcrumbsItem>
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
                                  setDestination({
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
                    {parentEntries?.map(({id, title}) => {
                      return (
                        <BreadcrumbsItem key={id}>
                          <button
                            type="button"
                            style={{cursor: 'pointer'}}
                            onClick={() => {
                              setDestination({
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
              onlyImages={type === 'image'}
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
