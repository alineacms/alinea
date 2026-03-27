import {act, cleanup, render} from '@testing-library/react'
import {Config} from 'alinea'
import {createCMS} from 'alinea/core'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {TextNode} from 'alinea/core/TextDoc'
import {richText} from 'alinea/field/richtext'
import 'alinea/v2/dom'
import {Dashboard, EditorScope} from 'alinea/v2/store'
import {afterEach, expect, test} from 'bun:test'
import {createStore, Provider} from 'jotai'
import {RichTextFieldView} from './RichTextField.view.js'
import {views} from '../views.js'

const Article = Config.document('Article', {
  fields: {
    body: richText('Body')
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

afterEach(function cleanupView() {
  cleanup()
})

test('renders existing rich text content without crashing', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(db, cms.config, db.index, undefined!, views)

  const entry = await db.create({
    type: Article,
    root: 'pages',
    set: {
      title: 'Article',
      body: [
        {
          _type: 'paragraph',
          content: [{_type: 'text', text: 'Hello world'}]
        }
      ]
    }
  })

  const loaded = await store.get(dashboard.entries[entry._id])
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>
        <RichTextFieldView field={Article.body} />
      </EditorScope>
    </Provider>
  )

  expect(view.getByRole('textbox')).toBeTruthy()
  expect(view.getByText('Hello world')).toBeTruthy()
})

test('writes editor content changes back into the field value', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(db, cms.config, db.index, undefined!, views)

  const entry = await db.create({
    type: Article,
    root: 'pages',
    set: {
      title: 'Article',
      body: [
        {
          _type: 'paragraph',
          content: [{_type: 'text', text: 'Before'}]
        }
      ]
    }
  })

  const loaded = await store.get(dashboard.entries[entry._id])
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>
        <RichTextFieldView field={Article.body} />
      </EditorScope>
    </Provider>
  )

  const input = view.getByRole('textbox') as HTMLElement & {
    editor?: {
      commands: {setContent: (content: string, emitUpdate?: boolean) => void}
    }
  }

  await act(async function updateContent() {
    input.editor?.commands.setContent('<p>After</p>', true)
    await Promise.resolve()
  })

  expect(store.get(editor.field.body!.value)).toEqual([
    {
      _type: 'paragraph',
      content: [{_type: 'text', [TextNode.text]: 'After'}]
    }
  ])
})
