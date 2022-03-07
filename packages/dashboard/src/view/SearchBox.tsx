import {Entry} from '@alinea/core/Entry'
import {Search} from '@alinea/core/Search'
import {fromModule, HStack, IconButton, Stack} from '@alinea/ui'
import {useLayoutEffect, useMemo, useState} from 'react'
import {MdOutlineGridView, MdOutlineList, MdSearch} from 'react-icons/md'
import {useHistory, useLocation} from 'react-router'
import {useDashboard} from '../hook/UseDashboard'
import {useFocusList} from '../hook/UseFocusList'
import {useRoot} from '../hook/UseRoot'
import {useWorkspace} from '../hook/UseWorkspace'
import {Explorer} from './explorer/Explorer'
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
  search: string
  root: string
}

function query({workspace, search, root}: QueryParams) {
  return Search.leftJoin(Entry, Search.id.is(Entry.id))
    .where(search ? Search.title.match(searchTerms(search)) : false)
    .where(Entry.workspace.is(workspace))
    .orderBy(Entry.root.is(root).desc(), Search.get('rank').asc())
}

export function SearchBox() {
  const {nav} = useDashboard()
  const history = useHistory()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const list = useFocusList({
    onClear: () => setSearch('')
  })
  const {workspace, schema} = useWorkspace()
  const {root} = useRoot()
  const cursor = useMemo(
    () => query({workspace, root, search}),
    [workspace, root, search]
  )
  const [explorerView, setExplorerView] = useState<'row' | 'thumb'>('row')
  // If we navigate to another page (for example by selecting one of the items)
  // clear the search term
  useLayoutEffect(() => {
    setSearch('')
  }, [location])
  return (
    <div
      className={styles.root()}
      onFocus={() => {
        setIsOpen(true)
        list.focusProps.onFocus()
      }}
      onBlur={({currentTarget, relatedTarget}) => {
        if (currentTarget.contains(relatedTarget as Node)) return
        setIsOpen(false)
        list.focusProps.onBlur()
      }}
    >
      <div>
        <label className={styles.root.label()} {...list.focusProps}>
          <MdSearch size={15} className={styles.root.label.icon()} />
          <input
            autoFocus
            placeholder="Search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className={styles.root.label.input()}
          />
          {isOpen && (
            <Stack.Right>
              <HStack gap={10}>
                <IconButton
                  size={12}
                  icon={MdOutlineList}
                  active={explorerView === 'row'}
                  onClick={() => setExplorerView('row')}
                />
                <IconButton
                  size={12}
                  icon={MdOutlineGridView}
                  active={explorerView === 'thumb'}
                  onClick={() => setExplorerView('thumb')}
                />
              </HStack>
            </Stack.Right>
          )}
        </label>
      </div>
      <list.Container>
        {isOpen && search && (
          <div className={styles.root.popover()}>
            <Explorer
              schema={schema}
              cursor={cursor}
              type={explorerView}
              toggleSelect={entry =>
                history.push(nav.entry(entry.workspace, entry.root, entry.id))
              }
              max={25}
            />
          </div>
        )}
      </list.Container>
    </div>
  )
}
