import {cleanup, render} from '@testing-library/react'
import {Config} from '#/index.js'
import {createCMS} from '#/core.js'
import {TestDB} from '#/core/db/TestDB.js'
import {Type} from '#/core/Type.js'
import {Dashboard, DashboardEditor, EditorScope} from '#/v2/store.js'
import {createStore, Provider} from 'jotai'
import {ReactNode} from 'react'

export interface RenderFieldOptions {
  render: (editor: DashboardEditor) => ReactNode
  set?: Record<string, unknown>
  type: Type
}

export async function renderField({
  render: renderFieldView,
  set = {},
  type
}: RenderFieldOptions) {
  cleanup()

  const cms = createCMS({
    schema: {Test: type},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {
          pages: Config.root('Pages')
        }
      })
    }
  })

  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(
    db,
    cms.config,
    db.index,
    undefined!,
    {}
  )

  const entry = await db.create({
    type,
    root: 'pages',
    set: {title: 'Entry', ...set}
  })

  const loaded = await store.get(dashboard.entries(entry._id))
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>{renderFieldView(editor)}</EditorScope>
    </Provider>
  )

  return {editor, store, view}
}
