import {Entry} from '@alinea/core/Entry'
import {Outcome} from '@alinea/core/Outcome'
import {Search} from '@alinea/core/Search'
import {SelectionInput} from '@alinea/store/Selection'
import {fromModule} from '@alinea/ui'
import {
  Combobox,
  ComboboxItem,
  ComboboxPopover,
  useComboboxState
} from 'ariakit/cjs/combobox/index.js'
import {PopoverAnchor} from 'ariakit/cjs/popover/index.js'
import {useEffect, useMemo, useRef, useState} from 'react'
import {MdSearch} from 'react-icons/md'
import {useQuery} from 'react-query'
import {useLocation} from 'react-router'
import {Link} from 'react-router-dom'
import {useDashboard} from '../hook/UseDashboard'
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

function query(workspace: string, terms: string) {
  return Search.leftJoin(Entry, Search.id.is(Entry.id))
    .where(Search.title.match(searchTerms(terms)))
    .where(Entry.workspace.is(workspace))
    .orderBy(Search.get('rank').asc())
    .take(10)
}

export function SearchBox() {
  const {nav} = useDashboard()
  const location = useLocation()
  const [search, setSearch] = useState('')
  // Todo: select first match
  const combobox = useComboboxState({
    gutter: 8,
    value: search,
    setValue: setSearch
  })
  const {hub} = useSession()
  const {workspace, schema} = useWorkspace()
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
          query(workspace, combobox.value).select(
            Entry.type.case(selection, EntrySummaryRow.selection(Entry))
          )
        )
        .then(Outcome.unpack)
    },
    {keepPreviousData: true}
  )
  const anchorRef = useRef(null)
  useEffect(() => {
    setSearch('')
  }, [location])
  return (
    <div className={styles.root()}>
      <PopoverAnchor state={combobox}>
        <label className={styles.root.label()} ref={anchorRef}>
          <MdSearch size={15} />
          <Combobox
            state={combobox}
            placeholder="Search"
            className={styles.root.label.input()}
          />
        </label>
      </PopoverAnchor>
      <ComboboxPopover state={combobox} className={styles.root.popover()}>
        {data?.map(entry => {
          const View =
            schema.type(entry.type)?.options.summaryRow || EntrySummaryRow
          return (
            <ComboboxItem
              as={Link}
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
