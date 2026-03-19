import {fireEvent, render, within} from '@testing-library/react'
import {Config} from 'alinea'
import {createCMS} from 'alinea/core'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {list} from 'alinea/field/list'
import {text} from 'alinea/field/text'
import {Dashboard} from 'alinea/v2/store'
import {EditorScope} from 'alinea/v2/store'
import {expect, test} from 'bun:test'
import {atom, createStore, Provider} from 'jotai'
import 'alinea/v2/dom.js'
import {views} from './views.js'
import {ListFieldView} from './ListField.view.js'

const Article = Config.document('Article', {
  fields: {
    blocks: list('Blocks', {
      schema: {
        item: Config.type('Item', {
          fields: {
            title: text('Title')
          }
        })
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

async function renderField() {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(
    atom(db),
    atom(cms.config),
    atom(db),
    atom(views)
  )

  const entry = await db.create({
    type: Article,
    root: 'pages',
    set: {title: 'Article'}
  })

  const loaded = await store.get(dashboard.entries[entry._id])
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>
        <ListFieldView field={Article.blocks} />
      </EditorScope>
    </Provider>
  )

  return {db, store, editor, view}
}

test('adds a list item and updates nested field values', async () => {
  const {store, editor, view} = await renderField()

  fireEvent.click(view.getByRole('button', {name: 'Add Item'}))

  expect(view.getByRole('textbox', {name: 'Title'})).toBeTruthy()
  expect(store.get(editor.field.blocks!.value)).toMatchObject([
    {_type: 'item', title: ''}
  ])
})

test('moves and removes list items', async () => {
  const {store, editor, view} = await renderField()

  fireEvent.click(view.getByRole('button', {name: 'Add Item'}))
  fireEvent.click(view.getByRole('button', {name: 'Add Item'}))

  const beforeMove = store.get(editor.field.blocks!.value) as Array<{
    _id: string
  }>

  fireEvent.click(
    within(view.getByRole('region', {name: 'Item item 1'})).getByRole(
      'button',
      {name: 'Move Item down'}
    )
  )

  const afterMove = store.get(editor.field.blocks!.value) as Array<{_id: string}>
  expect(afterMove.map(item => item._id)).toEqual([
    beforeMove[1]._id,
    beforeMove[0]._id
  ])

  fireEvent.click(
    within(view.getByRole('region', {name: 'Item item 1'})).getByRole(
      'button',
      {name: 'Remove Item'}
    )
  )

  const items = store.get(editor.field.blocks!.value) as Array<{_id: string}>
  expect(items.map(item => item._id)).toEqual([beforeMove[0]._id])
})
