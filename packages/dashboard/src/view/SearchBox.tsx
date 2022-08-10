import {Entry} from '@alinea/core/Entry'
import {Search} from '@alinea/core/Search'
import {fromModule, HStack, IconButton, Stack} from '@alinea/ui'
import {IcOutlineGridView} from '@alinea/ui/icons/IcOutlineGridView'
import {IcOutlineList} from '@alinea/ui/icons/IcOutlineList'
import {IcRoundSearch} from '@alinea/ui/icons/IcRoundSearch'
import {useLayoutEffect, useMemo, useState} from 'react'
import {useLocation, useNavigate} from 'react-router'
import {useFocusList} from '../hook/UseFocusList'
import {useNav} from '../hook/UseNav'
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
  const nav = useNav()
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const list = useFocusList({
    onClear: () => setSearch('')
  })
  const {name: workspace, schema} = useWorkspace()
  const {name: root} = useRoot()
  const cursor = useMemo(
    () => query({workspace, root, search}).select(Entry.fields),
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
          <IcRoundSearch className={styles.root.label.icon()} />
          <input
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
                  icon={IcOutlineList}
                  active={explorerView === 'row'}
                  onClick={() => setExplorerView('row')}
                />
                <IconButton
                  size={12}
                  icon={IcOutlineGridView}
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
              toggleSelect={entry => navigate(nav.entry(entry.alinea))}
              max={25}
            />
          </div>
        )}
      </list.Container>
    </div>
  )
}
