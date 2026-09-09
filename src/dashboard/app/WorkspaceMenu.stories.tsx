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
    <StoryProvider client={db} config={cms.config} events={db.index} graph={db}>
      <WorkspaceMenu
        canManageMembers={false}
        page={page}
        root={rootAtoms('simple', 'pages')}
        workspace={{...workspace, name: 'simple'}}
      />
    </StoryProvider>
  )
}

export function LocalizedGlobalSearchStory() {
  const workspace = getWorkspace(cms.config.workspaces.i18n)
  const page = {
    type: 'entry' as const,
    workspace: 'i18n',
    root: 'pages',
    entry: undefined,
    locale: 'en',
    view: undefined
  }
  return (
    <StoryProvider client={db} config={cms.config} events={db.index} graph={db}>
      <WorkspaceMenu
        canManageMembers={false}
        page={page}
        root={rootAtoms('i18n', 'pages')}
        workspace={{...workspace, name: 'i18n'}}
      />
    </StoryProvider>
  )
}

export default {
  title: 'Dashboard / WorkspaceMenu'
}
