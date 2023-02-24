import {Entry, Outcome} from 'alinea/core'
import {Button, HStack, Stack, Typo, VStack, fromModule, px} from 'alinea/ui'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {useState} from 'react'
import {useQuery} from 'react-query'
import {CurrentDraftProvider} from '../hook/UseCurrentDraft.js'
import {useDraft} from '../hook/UseDraft.js'
import {useDraftsList} from '../hook/UseDraftsList.js'
import {useNav} from '../hook/UseNav.js'
import {useSession} from '../hook/UseSession.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import css from './DraftsOverview.module.scss'
import {EntryEdit} from './EntryEdit.js'
import {Sidebar} from './Sidebar.js'
import {EditMode} from './entry/EditMode.js'
import {TreeNode} from './tree/TreeNode.js'

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
  )
}
