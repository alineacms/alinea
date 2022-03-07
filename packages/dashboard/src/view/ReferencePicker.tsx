import {createId} from '@alinea/core'
import {Entry} from '@alinea/core/Entry'
import {Reference} from '@alinea/core/Reference'
import {Search} from '@alinea/core/Search'
import {
  Button,
  fromModule,
  HStack,
  IconButton,
  Loader,
  px,
  Stack,
  Typo,
  VStack
} from '@alinea/ui'
import {Modal} from '@alinea/ui/Modal'
import {Suspense, useCallback, useMemo, useState} from 'react'
import {
  MdArrowBack,
  MdOutlineGridView,
  MdOutlineList,
  MdSearch
} from 'react-icons/md'
import {useFocusList} from '../hook/UseFocusList'
import {ReferencePickerOptions} from '../hook/UseReferencePicker'
import {useRoot} from '../hook/UseRoot'
import {useWorkspace} from '../hook/UseWorkspace'
import {Explorer} from './explorer/Explorer'
import {FileUploader} from './media/FileUploader'
import css from './ReferencePicker.module.scss'

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

export type ReferencePickerProps = {
  options: ReferencePickerOptions
  onConfirm: (value: Array<Reference> | undefined) => void
  onCancel: () => void
}

export function ReferencePicker({
  options,
  onConfirm,
  onCancel
}: ReferencePickerProps) {
  const {defaultView, max, condition} = options
  const [search, setSearch] = useState('')
  const list = useFocusList({
    onClear: () => setSearch('')
  })
  const [selection, setSelection] = useState<Array<Reference>>(
    () => options.selection || []
  )
  const {workspace, schema} = useWorkspace()
  const {root} = useRoot()
  const cursor = useMemo(
    () => query({workspace, root, search}).where(condition || true),
    [workspace, root, search, condition]
  )
  const [view, setView] = useState<'row' | 'thumb'>(defaultView || 'row')
  const handleSelect = useCallback(
    (entry: Entry.Minimal) => {
      setSelection(selected => {
        const index = selected.findIndex(
          v => v.type === 'entry' && v.entry === entry.id
        )
        let res = selected.slice()
        if (index === -1) {
          res = res
            .concat({
              id: createId(),
              type: 'entry',
              entry: entry.id
            })
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
    [setSelection, max]
  )
  function handleConfirm() {
    onConfirm(selection)
  }
  return (
    <Modal open onClose={onCancel}>
      <Suspense fallback={<Loader absolute />}>
        <HStack center gap={18} className={styles.root.header()}>
          <IconButton icon={MdArrowBack} onClick={onCancel} />
          <Typo.H1 flat>Select a reference</Typo.H1>
        </HStack>

        <label className={styles.root.label()}>
          <MdSearch size={15} className={styles.root.label.icon()} />
          <input
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
                icon={MdOutlineList}
                active={view === 'row'}
                onClick={() => setView('row')}
              />
              <IconButton
                icon={MdOutlineGridView}
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
          {!search && <FileUploader max={max} toggleSelect={handleSelect} />}
          <VStack style={{flexGrow: 1, minHeight: 0}}>
            <list.Container>
              <div className={styles.root.results()}>
                <Explorer
                  virtualized
                  schema={schema}
                  cursor={cursor}
                  type={view}
                  selectable
                  selection={selection}
                  toggleSelect={handleSelect}
                />
              </div>
            </list.Container>
          </VStack>
        </HStack>
        <HStack as="footer">
          <Stack.Right>
            <Button size="large" onClick={handleConfirm}>
              Confirm
            </Button>
          </Stack.Right>
        </HStack>
      </Suspense>
    </Modal>
  )
}
