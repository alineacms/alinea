import {Config} from 'alinea'
import {Entry, createCMS} from 'alinea/core'
import {Field} from 'alinea/core/Field'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {object} from 'alinea/field/object'
import {text} from 'alinea/field/text'
import {expect, test} from 'bun:test'
import '../dom.js'
import {fireEvent, render} from '@testing-library/react'
import {atom, createStore, Provider} from 'jotai'
import {EditorScope, useField, useFieldScope} from './hooks.js'
import {Dashboard} from './Dashboard.js'

const Article = Config.document('Article', {
  fields: {
    title: text('Title'),
    seo: object('SEO', {
      fields: {
        description: text('Description')
      }
    })
  }
})

const cms = createCMS({
  schema: {Article},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages')
      }
    })
  }
})

function Inner() {
  const [value = '', setValue] = useField(Article.seo.description)
  return (
    <button onClick={() => setValue('Meta')} type="button">
      {value}
    </button>
  )
}

function Outer() {
  const Scope = useFieldScope(Article.seo, Field.options(Article.seo).fields)
  return (
    <Scope>
      <Inner />
    </Scope>
  )
}

test('useFieldScope creates a nested scope that updates the parent field value', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))

  const entry = await db.create({
    type: Article,
    root: 'pages',
    set: {title: 'Hello'}
  })

  const loaded = await store.get(dashboard.entries[entry._id])
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>
        <Outer />
      </EditorScope>
    </Provider>
  )

  fireEvent.click(view.getByRole('button'))

  expect(store.get(editor.field.seo.value)).toEqual({description: 'Meta'})
  expect(store.get(editor.value)).toMatchObject({
    title: 'Hello',
    path: 'hello',
    seo: {description: 'Meta'}
  })
})
