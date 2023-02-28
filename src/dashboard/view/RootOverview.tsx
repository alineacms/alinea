import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {fromModule, Icon, TextLabel, Typo} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import css from './RootOverview.module.scss'

const styles = fromModule(css)

export interface RootOverviewProps {
  workspace: Workspace
  root: Root
}

export function RootOverview({workspace, root}: RootOverviewProps) {
  return (
    <Main>
      <div className={styles.root()}>
        <Icon icon={root.icon} className={styles.root.icon()} />
        <Typo.H2>
          <TextLabel label={root.label} />
        </Typo.H2>
        <Typo.P>
          Select an entry in the navigation tree on the left to start editing
        </Typo.P>
      </div>
    </Main>
  )
}

/*


function RedirectToFirstEntry({workspace, root}: EntryLocation) {
  const navigate = useNavigate()
  const nav = useNav()
  const {hub} = useSession()
  const {data: topEntries} = useQuery(['top-entry', workspace, root], () => {
    return hub
      .query({
        cursor: Entry.where(Entry.workspace.is(workspace!))
          .where(Entry.root.is(root!))
          .where(Entry.parent.isNull())
          .select({id: Entry.id})
          .orderBy(Entry.index.asc())
          .take(1)
      })
      .then(Outcome.unpack)
  })
  const entry = topEntries?.[0]
  useEffect(() => {
    if (entry) navigate(nav.entry({workspace, root, id: entry.id}))
  }, [entry])
  return <Loader absolute />
}

*/
