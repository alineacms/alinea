import {Config} from 'alinea'
import {json} from 'alinea/field/json'
import {expect, test} from 'bun:test'
import 'alinea/v2/dom.js'
import {renderField} from 'alinea/v2/fixture/testUtils'
import {JsonFieldView} from './JsonField.view.js'

const Article = Config.document('Article', {
  fields: {
    settings: json<Record<string, unknown>>('Settings')
  }
})

test('renders the stored json field value as formatted text', async () => {
  const {view} = await renderField({
    type: Article,
    set: {
      settings: {
        enabled: true,
        count: 2
      }
    },
    render() {
      return <JsonFieldView field={Article.settings} />
    }
  })

  const input = view.container.querySelector('textarea') as HTMLTextAreaElement
  expect(input).toBeTruthy()
  expect(input.value).toBe('{\n  "enabled": true,\n  "count": 2\n}')
})
