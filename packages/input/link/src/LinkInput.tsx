import {Entry, Search} from '@alinea/core'
import {useRoot, useSession, useWorkspace} from '@alinea/dashboard'
import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule} from '@alinea/ui'
import {useState} from 'react'
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
  const {hub} = useSession()
  const {workspace} = useWorkspace()
  const root = useRoot()
  const [value, setValue] = useInput(state)
  const {optional, help} = field.options
  const [search, setSearch] = useState('')
  /*const {data} = useQuery(['link', workspace, root], () => {
    return hub.query(query({workspace, root, terms: search})).then(Outcome.unpack)
  })*/
  return (
    <div className={styles.root()}>
      <InputLabel asLabel label={field.label} help={help} optional={optional}>
        <input value={search} onChange={e => setSearch(e.target.value)} />
      </InputLabel>
    </div>
  )
}
