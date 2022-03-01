import {Entry, Search} from '@alinea/core'
import {
  useDashboard,
  useReferencePicker,
  useRoot,
  useSession,
  useWorkspace
} from '@alinea/dashboard'
import {InputState, useInput} from '@alinea/editor'
import {Create, fromModule} from '@alinea/ui'
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
