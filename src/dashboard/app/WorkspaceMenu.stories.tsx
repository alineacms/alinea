import {getWorkspace} from '#/core/Internal.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {cms, db} from '#/dashboard/fixture/cms.ts?alinea'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'

export function GlobalSearchStory() {
  const workspace = getWorkspace(cms.config.workspaces.simple)
  const page = {
    type: 'entry' as const,
    workspace: 'simple',
    root: 'pages',
    entry: undefined,
    locale: null,
    view: undefined
  }
  return (
    <StoryProvider client={db} config={cms.config} events={db} graph={db}>
      <WorkspaceMenu
        canManageMembers={false}
        page={page}
        root={rootAtoms('simple', 'pages')}
        workspace={{...workspace, name: 'simple'}}
      />
    </StoryProvider>
  )
}

export default {
  title: 'Dashboard / WorkspaceMenu'
}
