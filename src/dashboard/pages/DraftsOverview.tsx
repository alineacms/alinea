import {Entry} from 'alinea/core/Entry'
import {Button, HStack, Stack, Typo, VStack, fromModule, px} from 'alinea/ui'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {useAtomValue} from 'jotai'
import {useQuery} from 'react-query'
import {graphAtom} from '../atoms/DbAtoms.js'
import {EntryEditor} from '../atoms/EntryEditorAtoms.js'
import {useNav} from '../hook/UseNav.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {EntryEdit} from '../view/EntryEdit.js'
import {Sidebar} from '../view/Sidebar.js'
import css from './DraftsOverview.module.scss'

const styles = fromModule(css)

export interface DraftsOverviewProps {
  editor?: EntryEditor
}

export function DraftsOverview({editor}: DraftsOverviewProps) {
  const graph = useAtomValue(graphAtom)
  const nav = useNav()
  const workspace = useWorkspace()
  const {data, refetch} = useQuery(
    ['drafts-overview'],
    () => {
      return graph.drafts.find(Entry({workspace: workspace.name}))
    },
    {suspense: true}
  )
  const drafts = data!
  const selected =
    editor?.entryId && drafts.find(d => d.entryId === editor?.entryId)
  function handlePublish() {
    /*if (publishing) return
    setPublishing(true)
    return hub
      .publishEntries({entries: drafts})
      .then(Outcome.unpack)
      .then(() => refetch())
      .finally(() => setPublishing(false))*/
  }
  return (
    <>
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
              <div key={draft.entryId}>
                {draft.title}
                {/*<TreeNode
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
                />*/}
              </div>
            )
          })}
        </VStack>
      </Sidebar.Tree>
      {selected && editor && <EntryEdit editor={editor} />}
    </>
  )
}
