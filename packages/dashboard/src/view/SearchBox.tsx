import {Entry} from '@alinea/core/Entry'
import {Outcome} from '@alinea/core/Outcome'
import {Search} from '@alinea/core/Search'
import {SelectionInput} from '@alinea/store/Selection'
import {fromModule, HStack, IconButton, Stack} from '@alinea/ui'
import {
  Combobox,
  ComboboxItem,
  ComboboxPopover,
  useComboboxState
} from 'ariakit/cjs/combobox/index.js'
import {PopoverAnchor} from 'ariakit/cjs/popover/index.js'
import {useLayoutEffect, useMemo, useRef, useState} from 'react'
import {MdOutlineGridView, MdOutlineList, MdSearch} from 'react-icons/md'
import {useQuery} from 'react-query'
import {useLocation} from 'react-router'
import {Link} from 'react-router-dom'
import {useDashboard} from '../hook/UseDashboard'
import {useRoot} from '../hook/UseRoot'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {EntrySummaryRow} from './entry/EntrySummary'
import css from './SearchBox.module.scss'

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
  terms: string
  root: string
}

function query({workspace, terms, root}: QueryParams) {
  return Search.leftJoin(Entry, Search.id.is(Entry.id))
    .where(Search.title.match(searchTerms(terms)))
    .where(Entry.workspace.is(workspace))
    .orderBy(Entry.root.is(root).desc(), Search.get('rank').asc())
    .take(20)
}

export function SearchBox() {
  const {nav} = useDashboard()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const combobox = useComboboxState({
    gutter: 8,
    value: search,
    setValue: setSearch,
    fixed: true
  })
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
    ['search', selection, combobox.value],
    async () => {
      if (combobox.value.length < 1) return undefined
      return hub
        .query(
          query({workspace, root, terms: combobox.value}).select(
            Entry.type.case(selection, EntrySummaryRow.selection(Entry))
          )
        )
        .then(Outcome.unpack)
    },
    {keepPreviousData: true}
  )
  const inputRef = useRef<HTMLInputElement>(null)
  // This is not very pretty - raise an issue to see if this is already
  // supported or could be
  useLayoutEffect(() => {
    combobox.setActiveId(data?.[0]?.id || null)
  }, [data, search])
  // If we navigate to another page (for example by selecting one of the items)
  // clear the search term
  useLayoutEffect(() => {
    setSearch('')
  }, [location])
  return (
    <div className={styles.root()}>
      <PopoverAnchor state={combobox}>
        <label className={styles.root.label()}>
          <MdSearch size={15} className={styles.root.label.icon()} />
          <Combobox
            state={combobox}
            placeholder="Search"
            className={styles.root.label.input()}
            ref={inputRef}
          />
          <Stack.Right>
            <HStack gap={10}>
              <IconButton
                size={12}
                icon={MdOutlineList}
                active
                onClick={e => combobox.setVisible(true)}
              />
              <IconButton
                size={12}
                icon={MdOutlineGridView}
                onClick={e => combobox.setVisible(true)}
              />
            </HStack>
          </Stack.Right>
        </label>
      </PopoverAnchor>
      <ComboboxPopover state={combobox} className={styles.root.popover()}>
        {data?.map((entry, i) => {
          const View =
            schema.type(entry.type)?.options.summaryRow || EntrySummaryRow
          return (
            <ComboboxItem
              as={Link}
              id={entry.id}
              key={entry.id}
              value={entry.id}
              to={nav.entry(entry.workspace, entry.root, entry.id)}
              className={styles.root.popover.item()}
            >
              <View {...entry} />
            </ComboboxItem>
          )
        })}
      </ComboboxPopover>
    </div>
  )
}
