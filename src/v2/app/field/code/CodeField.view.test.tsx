import {fireEvent} from '@testing-library/react'
import {Config} from 'alinea'
import {code} from 'alinea/field/code'
import {expect, test} from 'bun:test'
import 'alinea/v2/dom.js'
import {renderField} from 'alinea/v2/fixture/testUtils'
import {CodeFieldView} from './CodeField.view.js'

const Article = Config.document('Article', {
  fields: {
    snippet: code('Snippet')
  }
})

test('renders the stored code field value', async () => {
  const {view} = await renderField({
    type: Article,
    set: {
      snippet: 'const answer = 42;'
    },
    render() {
      return <CodeFieldView field={Article.snippet} />
    }
  })

  const input = view.container.querySelector('textarea') as HTMLTextAreaElement
  expect(input).toBeTruthy()
  expect(input.value).toBe('const answer = 42;')
})

test('inserts indentation when pressing tab', async () => {
  const {editor, store, view} = await renderField({
    type: Article,
    render() {
      return <CodeFieldView field={Article.snippet} />
    }
  })

  const input = view.container.querySelector('textarea') as HTMLTextAreaElement
  expect(input).toBeTruthy()

  input.focus()
  input.selectionStart = 0
  input.selectionEnd = 0
  fireEvent.keyDown(input, {key: 'Tab'})

  expect(store.get(editor.field('snippet')!.value)).toBe('  ')
})
