import {Entry, Outcome, Search} from '@alinea/core'
import {
  useDashboard,
  useReferencePicker,
  useRoot,
  useSession,
  useWorkspace
} from '@alinea/dashboard'
import {EntrySummaryRow} from '@alinea/dashboard/view/entry/EntrySummary'
import {InputLabel, InputState, useInput} from '@alinea/editor'
import {SelectionInput} from '@alinea/store/Selection'
import {Create, fromModule} from '@alinea/ui'
import {
  Combobox,
  ComboboxItem,
  ComboboxPopover,
  useComboboxState
} from 'ariakit/cjs/combobox/index.js'
import {PopoverAnchor} from 'ariakit/cjs/popover/index.js'
import {useMemo, useState} from 'react'
import {MdSearch} from 'react-icons/md'
import {useQuery} from 'react-query'
import {LinkField} from './LinkField'
import css from './LinkInput.module.scss'

const styles = fromModule(css)

type QueryParams = {
  workspace: string
  root: string
  terms: string
}

function searchTerms(input: string) {
  const terms = input
    .replace(/,/g, ' ')
    .split(' ')
    .filter(v => v)
    .map(term => `"${term}"*`)
  return terms.join(' AND ')
}

function query({workspace, root, terms}: QueryParams) {
  return Search.leftJoin(Entry, Search.id.is(Entry.id))
    .where(Search.title.match(searchTerms(terms)))
    .where(Entry.workspace.is(workspace))
    .select({
      id: Entry.id,
      workspace: Entry.workspace,
      root: Entry.root,
      type: Entry.type,
      title: Entry.title,
      url: Entry.url,
      parent: Entry.parent,
      $isContainer: Entry.$isContainer
    })
    .orderBy(Search.get('rank').asc())
    .take(10)
}

export type LinkInputProps = {
  state: InputState<string>
  field: LinkField
}

export function LinkInput({state, field}: LinkInputProps) {
  const {nav} = useDashboard()
  const {hub} = useSession()
  const {workspace, schema} = useWorkspace()
  const {root} = useRoot()
  const [value, setValue] = useInput(state)
  const {pickLink} = useReferencePicker()
  function handleCreate() {
    return pickLink({
      selection: []
    }).then(console.log, console.log)
  }
  return (
    <div>
      selection here
      <Create.Root>
        <Create.Button onClick={handleCreate}>Pick link</Create.Button>
      </Create.Root>
    </div>
  )
}

export function LinkInput__({state, field}: LinkInputProps) {
  const {nav} = useDashboard()
  const {hub} = useSession()
  const {workspace, schema} = useWorkspace()
  const {root} = useRoot()
  const [value, setValue] = useInput(state)
  const {optional, help} = field.options
  const [search, setSearch] = useState('')
  const combobox = useComboboxState({
    gutter: 8,
    value: search,
    setValue: setSearch,
    fixed: true
  })
  const selection = useMemo(() => {
    const cases: Record<string, SelectionInput> = {}
    for (const [name, type] of schema) {
      if (type.options.summaryRow)
        cases[name] = type.options.summaryRow.selection(Entry)
    }
    return cases
  }, [schema])
  const {data, isLoading} = useQuery(
    ['link', combobox.value],
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
  return (
    <div className={styles.root()}>
      <InputLabel asLabel label={field.label} help={help} optional={optional}>
        list of selected items here 123
        <PopoverAnchor state={combobox}>
          <div className={styles.root.label()}>
            <MdSearch size={15} className={styles.root.label.icon()} />
            <Combobox
              state={combobox}
              placeholder="Pick link"
              className={styles.root.label.input()}
            />
          </div>
        </PopoverAnchor>
        <ComboboxPopover state={combobox} className={styles.root.popover()}>
          {search ? (
            data?.map((entry, i) => {
              const View =
                schema.type(entry.type)?.options.summaryRow || EntrySummaryRow
              return (
                <ComboboxItem
                  id={entry.id}
                  key={entry.id}
                  value={entry.id}
                  className={styles.root.popover.item()}
                >
                  <View {...entry} />
                </ComboboxItem>
              )
            })
          ) : (
            <div>option to create a new entry or file here</div>
          )}
        </ComboboxPopover>
      </InputLabel>
    </div>
  )
}
