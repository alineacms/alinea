import {Entry} from '@alinea/core/Entry'
import {Outcome} from '@alinea/core/Outcome'
import {Reference} from '@alinea/core/Reference'
import {Search} from '@alinea/core/Search'
import {SelectionInput} from '@alinea/store/Selection'
import {fromModule, HStack, IconButton, Stack, Typo} from '@alinea/ui'
import {Modal} from '@alinea/ui/Modal'
import {useMemo, useState} from 'react'
import {
  MdArrowBack,
  MdOutlineGridView,
  MdOutlineList,
  MdSearch
} from 'react-icons/md'
import {useQuery} from 'react-query'
import {ReferencePickerOptions} from '../hook/UseReferencePicker'
import {useRoot} from '../hook/UseRoot'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {EntrySummaryRow} from './entry/EntrySummary'
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
    .take(10)
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
  const {hub} = useSession()
  const {workspace, schema} = useWorkspace()
  const {root} = useRoot()
  const selection = useMemo(() => {
    const cases: Record<string, SelectionInput> = {}
    for (const [name, type] of schema) {
      if (type.options.summaryRow)
        cases[name] = type.options.summaryRow.selection(Entry)
    }
    return cases
  }, [schema])
  const {data, isLoading} = useQuery(
    ['link', workspace, search],
    async () => {
      return hub
        .query(
          query({workspace, root, search}).select(
            Entry.type.case(selection, EntrySummaryRow.selection(Entry))
          )
        )
        .then(Outcome.unpack)
    },
    {keepPreviousData: true}
  )
  const cursor = useMemo(
    () => query({workspace, root, search}),
    [workspace, root, search]
  )
  const [view, setView] = useState<'row' | 'thumb'>('row')
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
          className={styles.root.label.input()}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </label>
      <div className={styles.root.results()}>
        <Explorer schema={schema} cursor={cursor} type={view} />
      </div>
    </Modal>
  )
}
