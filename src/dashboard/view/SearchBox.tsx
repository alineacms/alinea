import styler from '@alinea/styler'
import {QueryWithResult} from 'alinea/core/Graph'
import {useLocation, useNavigate} from 'alinea/dashboard/util/HashRouter'
import {HStack, Stack} from 'alinea/ui'
import {IcOutlineGridView} from 'alinea/ui/icons/IcOutlineGridView'
import {IcOutlineList} from 'alinea/ui/icons/IcOutlineList'
import {IcRoundSearch} from 'alinea/ui/icons/IcRoundSearch'
import {memo, useLayoutEffect, useMemo, useState} from 'react'
import {useFocusList} from '../hook/UseFocusList.js'
import {useLocale} from '../hook/UseLocale.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {IconButton} from './IconButton.js'
import css from './SearchBox.module.scss'
import {Explorer, ExporerItemSelect} from './explorer/Explorer.js'

const styles = styler(css)

export const SearchBox = memo(function SearchBox() {
  const nav = useNav()
  const navigate = useNavigate()
  const location = useLocation()
  const {name: workspace} = useWorkspace()
  const {name: root} = useRoot()
  const locale = useLocale()
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const list = useFocusList({
    onClear: () => setSearch('')
  })
  const query = useMemo((): QueryWithResult<ExporerItemSelect> => {
    const terms = search.replace(/,/g, ' ').split(' ').filter(Boolean)
    return {
      select: undefined!,
      workspace: workspace,
      root: root,
      locale: locale,
      search: terms
    }
  }, [workspace, root, search, locale])
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
        //list.focusProps.onFocus()
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
              border={false}
              query={query}
              type={explorerView}
              toggleSelect={entry => navigate(nav.entry(entry))}
              max={25}
            />
          </div>
        )}
      </list.Container>
    </div>
  )
})
