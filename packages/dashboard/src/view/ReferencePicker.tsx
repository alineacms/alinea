import {createId} from '@alinea/core'
import {Entry} from '@alinea/core/Entry'
import {Reference} from '@alinea/core/Reference'
import {Search} from '@alinea/core/Search'
import {Button, fromModule, HStack, IconButton, Stack, Typo} from '@alinea/ui'
import {Modal} from '@alinea/ui/Modal'
import {useCallback, useMemo, useState} from 'react'
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
  return Search.leftJoin(Entry, Search.id.is(Entry.id))
    .where(search ? Search.title.match(searchTerms(search)) : true)
    .where(Entry.workspace.is(workspace))
    .orderBy(Entry.root.is(root).desc(), Search.get('rank').asc())
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
    () => query({workspace, root, search}),
    [workspace, root, search]
  )
  const [view, setView] = useState<'row' | 'thumb'>('row')
  const handleSelect = useCallback(
    (entry: Entry.Minimal) => {
      setSelection(selected => {
        const index = selected.findIndex(
          v => v.type === 'entry' && v.entry === entry.id
        )
        if (index === -1)
          return selected.concat({
            id: createId(),
            type: 'entry',
            entry: entry.id
          })
        const res = selected.slice()
        res.splice(index, 1)
        return res
      })
    },
    [setSelection]
  )
  function handleConfirm() {
    onConfirm(selection)
  }
  return (
    <Modal open onClose={onCancel}>
      <HStack center gap={18} className={styles.root.header()}>
        <IconButton icon={MdArrowBack} onClick={onCancel} />
        <Typo.H1 flat>Select a reference</Typo.H1>
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
      </label>
      <list.Container>
        <div className={styles.root.results()}>
          <Explorer
            virtualized
            schema={schema}
            cursor={cursor}
            type={view}
            selectable
            selection={selection}
            onSelect={handleSelect}
          />
        </div>
      </list.Container>
      <HStack as="footer">
        <Stack.Right>
          <Button size="large" onClick={handleConfirm}>
            Confirm
          </Button>
        </Stack.Right>
      </HStack>
    </Modal>
  )
}
