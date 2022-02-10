import {Entry} from '@alinea/core/Entry'
import {Outcome} from '@alinea/core/Outcome'
import {Search} from '@alinea/core/Search'
import {useField} from '@alinea/editor'
import {text} from '@alinea/input.text'
import {MdSearch} from 'react-icons/md'
import {useQuery} from 'react-query'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'

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
    .select({
      id: Entry.id,
      workspace: Entry.workspace,
      root: Entry.root,
      type: Entry.type,
      title: Entry.title,
      url: Entry.url,
      $parent: Entry.$parent,
      $isContainer: Entry.$isContainer
    })
    .orderBy(Search.get('rank').asc())
    .take(10)
}

export function SearchBox() {
  const terms = useField(text('Search', {iconLeft: MdSearch, inline: true}), '')
  const {hub} = useSession()
  const {workspace} = useWorkspace()
  const {data, isLoading} = useQuery(
    ['search', terms.value],
    async () => {
      if (terms.value.length < 2) return []
      return hub.query(query(workspace, terms.value)).then(Outcome.unpack)
    },
    {keepPreviousData: true}
  )
  return (
    <>
      <terms.input list="list" />
      <datalist id="list">
        {data?.map(entry => {
          return <option key={entry.id}>{entry.title}</option>
        })}
      </datalist>
    </>
  )
}
