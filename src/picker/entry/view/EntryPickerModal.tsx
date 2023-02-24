import {createId} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {Reference} from 'alinea/core/Reference'
import {Search} from 'alinea/core/Search'
import {useDashboard} from 'alinea/dashboard/hook/UseDashboard'
import {useFocusList} from 'alinea/dashboard/hook/UseFocusList'
import {useRoot} from 'alinea/dashboard/hook/UseRoot'
import {useWorkspace} from 'alinea/dashboard/hook/UseWorkspace'
import {Explorer} from 'alinea/dashboard/view/explorer/Explorer'
import {FileUploader} from 'alinea/dashboard/view/media/FileUploader'
import {PickerProps} from 'alinea/editor/Picker'
import {EntryReference} from 'alinea/picker/entry'
import {
  Button,
  fromModule,
  HStack,
  IconButton,
  Loader,
  px,
  Stack,
  TextLabel,
  Typo,
  VStack
} from 'alinea/ui'
import {IcOutlineGridView} from 'alinea/ui/icons/IcOutlineGridView'
import {IcOutlineList} from 'alinea/ui/icons/IcOutlineList'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundSearch} from 'alinea/ui/icons/IcRoundSearch'
import {Modal} from 'alinea/ui/Modal'
import {Suspense, useCallback, useMemo, useState} from 'react'
import {EntryPickerOptions} from '../EntryPicker.js'
import css from './EntryPicker.module.scss'

const styles = fromModule(css)

function searchTerms(input: string) {
  const terms = input
    .replace(/,/g, ' ')
    .split(' ')
    .filter(v => v)
    .map(term => `"${term}"*`)
  return terms.join(' AND ')
}

type QueryParams = {
  workspace: string
  search: string
  root: string
}

function query({workspace, search, root}: QueryParams) {
  const orderBy = search
    ? [Entry.root.is(root).desc(), Search.get('rank').asc()]
    : [Entry.id.desc()]
  return Search.leftJoin(Entry, Search.id.is(Entry.id))
    .where(search ? Search.title.match(searchTerms(search)) : true)
    .where(Entry.workspace.is(workspace))
    .orderBy(...orderBy)
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
  const {title, defaultView, max, condition, showUploader} = options
  const [search, setSearch] = useState('')
  const list = useFocusList({
    onClear: () => setSearch('')
  })
  const [selected, setSelected] = useState<Array<Reference>>(
    () => selection || []
  )
  const {schema} = useDashboard().config
  const {name: workspace} = useWorkspace()
  const {name: root} = useRoot()
  const cursor = useMemo(
    () =>
      query({workspace, root, search})
        .where(condition || true)
        .select(Entry.fields),
    [workspace, root, search, condition]
  )
  const [view, setView] = useState<'row' | 'thumb'>(defaultView || 'row')
  const handleSelect = useCallback(
    (entry: Entry.Minimal) => {
      setSelected(selected => {
        const index = selected.findIndex(
          v => EntryReference.isEntry(v) && v.entry === entry.id
        )
        let res = selected.slice()
        if (index === -1) {
          res = res
            .concat({
              id: createId(),
              type,
              entry: entry.id
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
  return (
    <Modal open onClose={onCancel} className={styles.root()}>
      <Suspense fallback={<Loader absolute />}>
        <HStack center gap={18} className={styles.root.header()}>
          <IconButton icon={IcRoundArrowBack} onClick={onCancel} />
          <Typo.H1 flat>
            {title ? <TextLabel label={title} /> : 'Select a reference'}
          </Typo.H1>
        </HStack>

        <label className={styles.root.label()}>
          <IcRoundSearch className={styles.root.label.icon()} />
          <input
            type="text"
            autoFocus
            placeholder="Search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className={styles.root.label.input()}
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
        <HStack
          gap={16}
          style={{flexGrow: 1, padding: `${px(16)} 0`, minHeight: 0}}
        >
          {!search && showUploader && (
            <FileUploader max={max} toggleSelect={handleSelect} />
          )}
          <VStack style={{flexGrow: 1, minHeight: 0}}>
            <list.Container>
              <div className={styles.root.results()}>
                <Explorer
                  virtualized
                  schema={schema}
                  cursor={cursor}
                  type={view}
                  selectable
                  selection={selected}
                  toggleSelect={handleSelect}
                />
              </div>
            </list.Container>
          </VStack>
        </HStack>
        <HStack as="footer">
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
