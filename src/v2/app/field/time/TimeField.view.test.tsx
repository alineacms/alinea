import {fireEvent} from '@testing-library/react'
import {Config} from 'alinea'
import {time} from 'alinea/field/time'
import {expect, test} from 'bun:test'
import 'alinea/v2/dom.js'
import {renderField} from 'alinea/v2/fixture/testUtils'
import {TimeFieldView} from './TimeField.view.js'

const Article = Config.document('Article', {
  fields: {
    publishTime: time('Publish time')
  }
})

test('updates the time field value', async () => {
  const {editor, store, view} = await renderField({
    type: Article,
    render() {
      return <TimeFieldView field={Article.publishTime} />
    }
  })

  const input = view.container.querySelector('input[type="time"]') as
    | HTMLInputElement
    | null
  expect(input).toBeTruthy()
  input!.value = '14:30'
  fireEvent.change(input!)

  expect(store.get(editor.field.publishTime!.value)).toBe('14:30')
})
