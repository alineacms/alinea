import {cleanup, render} from '@testing-library/react'
import {Config} from 'alinea'
import {createCMS} from 'alinea/core'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {Type} from 'alinea/core/Type'
import {Dashboard} from 'alinea/v2/store'
import {DashboardEditor, EditorScope} from 'alinea/v2/store'
import {atom, createStore, Provider} from 'jotai'
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
    atom(db),
    atom(cms.config),
    atom(db),
    atom({})
  )

  const entry = await db.create({
    type,
    root: 'pages',
    set: {title: 'Entry', ...set}
  })

  const loaded = await store.get(dashboard.entries[entry._id])
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>{renderFieldView(editor)}</EditorScope>
    </Provider>
  )

  return {editor, store, view}
}
