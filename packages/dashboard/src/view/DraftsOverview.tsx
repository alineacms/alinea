import {Entry, Outcome} from '@alinea/core'
import {Button, fromModule, HStack, px, Stack, Typo, VStack} from '@alinea/ui'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import {useState} from 'react'
import {useQuery} from 'react-query'
import {CurrentDraftProvider} from '../hook/UseCurrentDraft'
import {useDraft} from '../hook/UseDraft'
import {useDraftsList} from '../hook/UseDraftsList'
import {useNav} from '../hook/UseNav'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import css from './DraftsOverview.module.scss'
import {EditMode} from './entry/EditMode'
import {EntryEdit} from './EntryEdit'
import {Sidebar} from './Sidebar'
import {TreeNode} from './tree/TreeNode'

const styles = fromModule(css)

export type DraftsOverviewProps = {
  id?: string
}

export function DraftsOverview({id}: DraftsOverviewProps) {
  const {hub} = useSession()
  const nav = useNav()
  const workspace = useWorkspace()
  const {ids} = useDraftsList(workspace.name)
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
                    locale: draft.i18n?.locale!,
                    source: draft,
                    $isContainer: false,
                    childrenCount: 0,
                    parents: []
                  }}
                  locale={draft.i18n?.locale!}
                  level={0}
                  link={nav.draft({...draft, id: draft.id})}
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
  )
}
