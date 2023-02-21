import {Entry, Outcome} from '@alinea/core'
import {History} from '@alinea/dashboard/view/History'
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
          <Typo.H4 flat>ONGOING EDITS</Typo.H4>
        </HStack>
        <VStack>
          <div>
            <div className="is-draft alinea-TreeNode alinea-TreeNode-is-selected">
              <div className="alinea-TreeNode-inner">
                <a
                  draggable="false"
                  href="#/draft/web/data/20580nQzbOBR3Lt4kIdxyRGglc6"
                  className="alinea-TreeNode-link"
                  style={{paddingLeft: '10px'}}
                >
                  <div className="alinea-TreeNode-link-icon">
                    <svg
                      width="1em"
                      height="1em"
                      viewBox="0 0 24 24"
                      style={{fontSize: '0.75rem'}}
                    >
                      <path
                        fill="currentColor"
                        d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8.83c0-.53-.21-1.04-.59-1.41l-4.83-4.83c-.37-.38-.88-.59-1.41-.59H6zm7 6V3.5L18.5 9H14c-.55 0-1-.45-1-1z"
                      />
                    </svg>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      minWidth: '0px',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'unset',
                      gap: '0.5rem',
                      width: '100%'
                    }}
                  >
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                      }}
                    >
                      Roadmap
                    </span>
                    <div className="flex py-1 ml-2 -space-x-1 overflow-hidden italic">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4 mr-2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                          />
                        </svg>
                        Editing
                        <img
                          className="inline-block w-4 h-4 ml-1.5 rounded-full"
                          src="https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                          alt=""
                        />
                        <img
                          className="inline-block w-4 h-4 rounded-full"
                          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                          alt=""
                        />
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
            <div className="is-draft alinea-TreeNode">
              <div className="alinea-TreeNode-inner ">
                <a
                  draggable="false"
                  href="#/draft/web/data/20580nQzbOBR3Lt4kIdxyRGglc6"
                  className="alinea-TreeNode-link"
                  style={{paddingLeft: '10px'}}
                >
                  <div className="alinea-TreeNode-link-icon">
                    <svg
                      width="1em"
                      height="1em"
                      viewBox="0 0 24 24"
                      style={{fontSize: '0.75rem'}}
                    >
                      <path
                        fill="currentColor"
                        d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8.83c0-.53-.21-1.04-.59-1.41l-4.83-4.83c-.37-.38-.88-.59-1.41-.59H6zm7 6V3.5L18.5 9H14c-.55 0-1-.45-1-1z"
                      />
                    </svg>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      minWidth: '0px',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'unset',
                      gap: '0.5rem',
                      width: '100%'
                    }}
                  >
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                      }}
                    >
                      CLI
                    </span>
                    <div className="flex py-1 ml-2 -space-x-1 overflow-hidden italic">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4 mr-1"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                          />
                        </svg>
                        Editing
                        <img
                          className="inline-block w-4 h-4 ml-1.5 rounded-full"
                          src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80"
                          alt=""
                        />
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </VStack>
        <HStack
          center
          style={{padding: `${px(10)} ${px(20)}`, marginTop: '25px'}}
        >
          <Typo.H4 flat>DRAFTS</Typo.H4>
          <Stack.Right>
            <Button iconRight={IcRoundArrowForward} onClick={handlePublish}>
              Publish all
            </Button>
          </Stack.Right>
        </HStack>
        <VStack style={{flex: '1'}}>
          {drafts.map((draft, i) => {
            if (i === 3) return null
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
        <History />
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
