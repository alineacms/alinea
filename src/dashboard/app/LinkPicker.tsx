import {useAtomValue} from '../AtomHooks.js'
import {AtomSnapshot} from '../AtomSnapshot.js'
import {
  Button,
  ComboBox,
  ComboBoxItem,
  MultipleSelect,
  MultipleSelectItem,
  Tag
} from '#/components.js'
import {atom, useSetAtom} from 'jotai'
import {useEffect, useMemo, useState} from 'react'
import {useListData} from 'react-stately'
import type {Key} from 'react-aria-components'
import {createExplorerAtoms, type ExplorerOptions} from '../atoms/explorer.js'
import {selectedRootAtom, selectedWorkspaceAtom} from '../atoms/routing.js'
import {ExplorerHeader} from './Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSelection
} from './ExplorerModal.js'
import {
  createExplorerPickerSnapshot,
  ExplorerPickerContent
} from './ExplorerPickerContent.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  useDashboardModal
} from './ui/DashboardModal.js'
import {swr} from '../atoms/utils.js'
import type {LinkPickerPresentation} from '#/picker/entry.js'
import {unwrap} from 'jotai/utils'

export interface LinkPickerOptions extends ExplorerOptions {
  presentation?: LinkPickerPresentation
}

export function LinkPicker({
  presentation = 'full',
  ...options
}: LinkPickerOptions) {
  if (presentation === 'inline') return <LinkPickerInline options={options} />
  return (
    <DashboardModal size="explorer">
      <LinkPickerModalContent options={options} />
    </DashboardModal>
  )
}

interface ExplorerModalProps {
  options: ExplorerOptions
}

function LinkPickerModalContent({options}: ExplorerModalProps) {
  const modal = useDashboardModal()
  const workspace = useAtomValue(selectedWorkspaceAtom)
  const root = useAtomValue(selectedRootAtom)
  const location = options.location ?? {
    workspace,
    root: root ?? undefined
  }
  const [{explorer, snapshot, tree}] = useState(() => {
    const explorer = createExplorerAtoms(location, {
      ...options,
      searchDepth: 'all'
    })
    return {
      explorer,
      ...createExplorerPickerSnapshot(explorer, location.workspace)
    }
  })
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size
  const onSubmit = () => {
    onConfirm()
    modal.close()
  }
  return (
    <DashboardModalDialog aria-label="Pick a link" variant="explorer">
      <AtomSnapshot atom={snapshot}>
        {prepared => (
          <ExplorerModal>
            <ExplorerHeader
              controls={<DashboardModalCloseButton />}
              explorer={explorer}
              items={prepared.items}
            />
            <ExplorerPickerContent
              explorer={explorer}
              items={prepared.items}
              navigationLabel="Link folders"
              options={options}
              preparedTree={prepared.preparedTree}
              tree={tree}
            />
            <ExplorerModalFooter>
              <ExplorerModalSelection>
                {selectedItems} {selectedItems === 1 ? 'item' : 'items'}
                selected
              </ExplorerModalSelection>
              <ExplorerModalActions>
                <Button onPress={modal.close}>Cancel</Button>
                <Button intent="primary" onPress={onSubmit}>
                  Select
                </Button>
              </ExplorerModalActions>
            </ExplorerModalFooter>
          </ExplorerModal>
        )}
      </AtomSnapshot>
    </DashboardModalDialog>
  )
}

function LinkPickerInline({options}: ExplorerModalProps) {
  const workspace = useAtomValue(selectedWorkspaceAtom)
  const root = useAtomValue(selectedRootAtom)
  const location = options.location ?? {workspace, root: root ?? undefined}
  const [{explorer, optionsSnapshot}] = useState(() => {
    const explorer = createExplorerAtoms(location, {
      ...options,
      flatResults: options.pickChildren ? false : true
    })

    const optionsSnapshot = swr(
      atom(async get => {
        const {items} = await get(explorer.snapshot)
        const pickerItems = await Promise.all(
          items.map(async entry => {
            const {data} = get(entry.data)

            if (!data) {
              return {
                id: entry.id,
                name: 'Loading entry',
                depth: 0,
                sortKey: entry.id
              }
            }

            const entryData = get(data.entryData)
            const currentEntry = await get(data.currentEntry)

            return {
              id: entry.id,
              name: get(data.label),
              depth: entryData.parents.length,
              sortKey: [
                ...entryData.parents.map(parent => parent.index),
                currentEntry?.index ?? entry.id
              ].join('\0')
            }
          })
        )

        return pickerItems
          .sort((a, b) =>
            a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0
          )
          .map(({sortKey: _sortKey, ...item}) => item)
      })
    )

    return {explorer, optionsSnapshot}
  })

  const emptyItems: Array<LinkPickerItem> = []
  const itemsAtom = useMemo(
    () => unwrap(optionsSnapshot, previous => previous ?? emptyItems),
    [optionsSnapshot]
  )
  const items = useAtomValue(itemsAtom)

  const selectionMode = explorer.selectionMode
  const selection = useAtomValue(explorer.selection)
  const setSelection = useSetAtom(explorer.selection)
  const initialSelectionKey = options.initialSelection?.join(',') ?? ''

  useEffect(() => {
    setSelection(new Set(options.initialSelection))
  }, [initialSelectionKey, setSelection])

  return selectionMode === 'single' ? (
    <LinkPickerSingle
      explorer={explorer}
      initialSelection={selection}
      items={items}
    />
  ) : (
    <LinkPickerMultiple
      explorer={explorer}
      initialSelection={selection}
      items={items}
    />
  )
}

interface LinkPickerItem {
  id: string
  name: string
  depth: number
}

interface LinkPickerInputProps {
  explorer: ReturnType<typeof createExplorerAtoms>
  initialSelection: Set<Key> | 'all'
  items: Array<LinkPickerItem>
}

function LinkPickerSingle({
  explorer,
  initialSelection,
  items
}: LinkPickerInputProps) {
  const value =
    initialSelection === 'all' ? null : ([...initialSelection][0] ?? null)
  const selectedItem = items.find(item => item.id === value)
  const [search, setSearch] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const updateSelection = useLinkPickerSelection(explorer)
  const inputValue = isEditing ? search : search || selectedItem?.name || ''
  const normalizedQuery = search.toLocaleLowerCase()
  const filteredItems = items.filter(item =>
    item.name.toLocaleLowerCase().includes(normalizedQuery)
  )

  function onChange(key: Key | null) {
    setSearch('')
    setIsEditing(false)
    updateSelection(selection => {
      selection.clear()
      if (key !== null) selection.add(key)
    })
  }

  function onInputChange(nextSearch: string) {
    setIsEditing(true)
    setSearch(nextSearch)
  }

  return (
    <ComboBox
      defaultFilter={() => true}
      inputValue={inputValue}
      items={filteredItems}
      value={value}
      onBlur={() => setIsEditing(false)}
      onChange={onChange}
      onInputChange={onInputChange}
    >
      {item => (
        <ComboBoxItem
          id={item.id}
          textValue={item.name}
          style={{
            paddingInlineStart: `${item.depth * 0.6 + 0.4}rem`
          }}
        >
          {item.name}
        </ComboBoxItem>
      )}
    </ComboBox>
  )
}

function LinkPickerMultiple({
  explorer,
  initialSelection,
  items
}: LinkPickerInputProps) {
  const selectedItems = useListData<LinkPickerItem>({
    initialItems:
      initialSelection === 'all'
        ? items
        : items.filter(item => initialSelection.has(item.id))
  })
  const updateSelection = useLinkPickerSelection(explorer)

  return (
    <MultipleSelect
      items={items}
      selectedItems={selectedItems}
      tag={item => <Tag>{item.name}</Tag>}
      onItemInserted={id => updateSelection(selection => selection.add(id))}
      onItemCleared={id => updateSelection(selection => selection.delete(id))}
    >
      {item => (
        <MultipleSelectItem
          id={item.id}
          textValue={item.name}
          style={{
            paddingInlineStart: `${item.depth * 0.6 + 0.4}rem`
          }}
        >
          {item.name}
        </MultipleSelectItem>
      )}
    </MultipleSelect>
  )
}

function useLinkPickerSelection(
  explorer: ReturnType<typeof createExplorerAtoms>
) {
  const setSelection = useSetAtom(explorer.selection)
  const onConfirm = useSetAtom(explorer.onConfirm)

  return (update: (selection: Set<Key>) => void) => {
    setSelection(current => {
      const next = current === 'all' ? new Set<Key>() : new Set(current)
      update(next)
      return next
    })
    onConfirm()
  }
}
