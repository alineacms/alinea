import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import type {QueryWithResult} from 'alinea/core/Graph'
import {createId} from 'alinea/core/Id'
import {type PickerProps, pickerWithView} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {workspaceMediaDir} from 'alinea/core/util/EntryFilenames'
import {entries} from 'alinea/core/util/Objects'
import {useConfig} from 'alinea/dashboard/hook/UseConfig'
import {useEntryEditor} from 'alinea/dashboard/hook/UseEntryEditor'
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
  type ExporerItemSelect
} from 'alinea/dashboard/view/explorer/Explorer'
import {FileUploader} from 'alinea/dashboard/view/media/FileUploader'
import {Button, HStack, Icon, Loader, Stack, TextLabel, VStack} from 'alinea/ui'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {IcOutlineGridView} from 'alinea/ui/icons/IcOutlineGridView'
import {IcOutlineList} from 'alinea/ui/icons/IcOutlineList'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundSearch} from 'alinea/ui/icons/IcRoundSearch'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {useTranslation} from 'alinea/dashboard/hook/useTranslation'
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

export const copy = {
  title: 'Select a reference',
  search: {
    placeholder: 'Search'
  },
  button: {
    cancel: 'Cancel',
    confirm: 'Confirm'
  }
}

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
  const t = useTranslation(copy)
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
                  {title ? <TextLabel label={title} /> : t.title()}
                </h2>
              </VStack>
            </HStack>

            <label className={styles.root.search()}>
              <IcRoundSearch className={styles.root.search.icon()} />
              <input
                type="text"
                placeholder={t.search.placeholder()}
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
                {t.button.cancel()}
              </Button>
              <Button onClick={handleConfirm}>{t.button.confirm()}</Button>
            </HStack>
          </Stack.Right>
        </HStack>
      </Suspense>
    </Modal>
  )
}
