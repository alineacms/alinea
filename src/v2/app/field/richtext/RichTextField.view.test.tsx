import {act, cleanup, render} from '@testing-library/react'
import {Config} from 'alinea'
import type {Editor, JSONContent} from '@tiptap/react'
import {createCMS} from 'alinea/core'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {TextNode} from 'alinea/core/TextDoc'
import {richText} from 'alinea/field/richtext'
import {text} from 'alinea/field/text'
import 'alinea/v2/dom'
import {Dashboard, EditorScope} from 'alinea/v2/store'
import {afterEach, expect, test} from 'bun:test'
import {createStore, Provider} from 'jotai'
import {RichTextFieldView} from './RichTextField.view.js'
import {views} from '../views.js'

interface EditorElement extends HTMLElement {
  editor?: Editor
}

const Article = Config.document('Article', {
  fields: {
    body: richText('Body')
  }
})

const BlockArticle = Config.document('BlockArticle', {
  fields: {
    body: richText('Body', {
      schema: {
        Cta: Config.type('Call to action', {
          fields: {
            title: text('Title')
          }
        })
      }
    })
  }
})

const cms = createCMS({
  schema: {Article, BlockArticle},
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

  const loaded = await store.get(dashboard.entries(entry._id))
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

  const loaded = await store.get(dashboard.entries(entry._id))
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>
        <RichTextFieldView field={Article.body} />
      </EditorScope>
    </Provider>
  )

  const input = view.getByRole('textbox') as EditorElement

  await act(async function updateContent() {
    input.editor?.commands.setContent('<p>After</p>', true)
    await Promise.resolve()
  })

  expect(store.get(editor.field('body')!.value)).toEqual([
    {
      _type: 'paragraph',
      content: [{_type: 'text', [TextNode.text]: 'After'}]
    }
  ])
})

test('undoes rich text changes through history', async () => {
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

  const loaded = await store.get(dashboard.entries(entry._id))
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>
        <RichTextFieldView field={Article.body} />
      </EditorScope>
    </Provider>
  )

  const input = view.getByRole('textbox') as EditorElement

  await act(async function updateContent() {
    input.editor?.chain().focus().selectAll().insertContent('After').run()
    await Promise.resolve()
  })

  await act(async function undoContent() {
    input.editor?.commands.undo()
    await Promise.resolve()
  })

  expect(store.get(editor.field('body')!.value)).toEqual([
    {
      _type: 'paragraph',
      content: [{_type: 'text', [TextNode.text]: 'Before'}]
    }
  ])
})

test('preserves block field data when rich text content updates', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(db, cms.config, db.index, undefined!, views)

  const entry = await db.create({
    type: BlockArticle,
    root: 'pages',
    set: {
      title: 'Article',
      body: [
        {
          _type: 'Cta',
          _id: 'block-1',
          title: 'Hero'
        }
      ]
    }
  })

  const loaded = await store.get(dashboard.entries(entry._id))
  const editor = await store.get(loaded.editor)

  const view = render(
    <Provider store={store}>
      <EditorScope editor={editor}>
        <RichTextFieldView field={BlockArticle.body} />
      </EditorScope>
    </Provider>
  )

  const [input] = view.getAllByRole('textbox')
  expect(view.getByRole('textbox', {name: 'Title'})).toBeTruthy()

  await act(async function updateContent() {
    ;(input as HTMLElement & {
      editor?: {
        commands: {
          setContent: (content: JSONContent, emitUpdate?: boolean) => void
        }
      }
    }).editor?.commands.setContent(
      {
        type: 'doc',
        content: [
          {
            type: 'Cta',
            attrs: {_id: 'block-1'}
          },
          {
            type: 'paragraph',
            content: [{type: 'text', text: 'After'}]
          }
        ]
      },
      true
    )
    await Promise.resolve()
  })

  const value = store.get(editor.field('body')!.value) as Array<{
    _type: string
    _id: string
    title?: string
    content?: Array<{_type: string; text?: string}>
  }>
  const block = value.find(node => node._type === 'Cta')
  const paragraph = value.find(node => node._type === 'paragraph')

  expect(block).toMatchObject({
    _type: 'Cta',
    title: 'Hero'
  })
  expect(paragraph).toMatchObject({
    _type: 'paragraph',
    content: [{_type: 'text', text: 'After'}]
  })
})
