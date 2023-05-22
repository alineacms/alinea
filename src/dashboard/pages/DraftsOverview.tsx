import {fromModule} from 'alinea/ui'
import {useSession} from '../atoms/DashboardAtoms.js'
import {EntryEditor} from '../atoms/EntryEditor.js'
import {useNav} from '../hook/UseNav.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import css from './DraftsOverview.module.scss'

const styles = fromModule(css)

export interface DraftsOverviewProps {
  editor?: EntryEditor
}

export function DraftsOverview({editor}: DraftsOverviewProps) {
  const {cnx: hub} = useSession()
  const nav = useNav()
  const workspace = useWorkspace()
  return null
  /*const {ids} = useDraftsList(workspace.name)
  const {data, refetch} = useQuery(
    ['drafts-overview', ids],
    () => {
      const criteria = Entry.where(Entry.id.isIn(ids)).where(
        Entry.workspace.is(workspace.name)
      )
      const drafts = hub.query({cursor: criteria}).then(Outcome.unpack)
      return drafts
    },
    {suspense: true}
  )
  const drafts = data!
  const selected = id && drafts.find(d => d.id === id)
  const {draft, isLoading} = useDraft(id)
  const [publishing, setPublishing] = useState(false)
  function handlePublish() {
    if (publishing) return
    setPublishing(true)
    return hub
      .publishEntries({entries: drafts})
      .then(Outcome.unpack)
      .then(() => refetch())
      .finally(() => setPublishing(false))
  }
  return (
    <CurrentDraftProvider value={draft}>
      <Sidebar.Tree>
        <HStack center style={{padding: `${px(10)} ${px(20)}`}}>
          <Typo.H4 flat>DRAFTS</Typo.H4>
          <Stack.Right>
            <Button iconRight={IcRoundArrowForward} onClick={handlePublish}>
              Publish all
            </Button>
          </Stack.Right>
        </HStack>
        <VStack>
          {drafts.map(draft => {
            return (
              <div key={draft.id}>
                <TreeNode
                  entry={{
                    ...draft,
                    locale: draft.alinea.i18n?.locale!,
                    source: {
                      id: draft.id,
                      parent: draft.alinea.parent,
                      parents: draft.alinea.parents
                    },
                    alinea: {
                      ...draft.alinea,
                      i18n: draft.alinea.i18n!,
                      isContainer: false,
                      parents: []
                    },
                    childrenCount: 0
                  }}
                  locale={draft.alinea.i18n?.locale!}
                  level={0}
                  link={nav.draft({...draft.alinea, id: draft.id})}
                  isOpen={() => false}
                  toggleOpen={() => {}}
                />
              </div>
            )
          })}
        </VStack>
      </Sidebar.Tree>
      {selected && draft && (
        <EntryEdit
          initialMode={EditMode.Diff}
          draft={draft}
          isLoading={isLoading}
        />
      )}
    </CurrentDraftProvider>
  )*/
}
