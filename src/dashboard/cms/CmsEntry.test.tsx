import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {createTestConnection} from '#test/CreateConnection.js'
import * as cms from '#/cms.js'
import {
  EditField,
  FieldChrome,
  type FieldViewProps,
  useField,
  useFieldKey,
  useLocale,
  useSiblingFieldValue
} from '#/cms.js'
import {afterEach, expect, test} from 'bun:test'
import {useId} from 'react'
import {EntryEditor} from '../atoms/editor.js'
import {ReactiveNode} from '../atoms/ReactiveNode.js'
import {DashboardScopeInternal, EditorScope} from '../hooks.js'

afterEach(cleanup)

test('alinea/cms exports the custom UI api', () => {
  expect(Object.keys(cms).sort()).toEqual([
    'EditField',
    'EditFields',
    'EntryTable',
    'FieldChrome',
    'useEntry',
    'useField',
    'useFieldError',
    'useFieldKey',
    'useFieldOptions',
    'useFieldSetter',
    'useFieldValue',
    'useGraph',
    'useLocale',
    'useNavigate',
    'usePolicy',
    'usePreviewMetadata',
    'useSiblingFieldValue',
    'useUser'
  ])
})

type RangeField = Field.Create<number, {max?: number; help?: string}>

function RangeView({field}: FieldViewProps<RangeField>) {
  const [value = 0, setValue] = useField(field)
  const key = useFieldKey(field)
  const title = useSiblingFieldValue('title') as string
  const locale = useLocale()
  const id = useId()
  return (
    <FieldChrome field={field} htmlFor={id}>
      <input
        id={id}
        type="number"
        value={value}
        onChange={event => setValue(Number(event.target.value))}
      />
      <output>
        {key}:{value} of {title} in {locale ?? 'no locale'}
      </output>
    </FieldChrome>
  )
}

function range(
  label: string,
  options: Field.Options<RangeField> = {}
): RangeField {
  return Field.create({label, options, view: RangeView})
}

const rating = range('Rating', {
  help: 'From 1 to 5',
  validate: value => (value > 5 ? 'Too high' : undefined)
})
const Product = Config.document('Product', {
  fields: {title: Field.text('Title'), rating}
})

function testDashboard() {
  const config = Config.create({
    schema: {Product},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {pages: Config.root('Pages', {contains: ['Product']})}
      })
    }
  })
  const graph = new LocalDB(config)
  return {
    graph,
    config,
    events: new EventTarget(),
    client: createTestConnection(graph)
  }
}

test('a custom field view reads and writes its value through alinea/cms', () => {
  const node = new ReactiveNode<object>({title: 'Chair', rating: 3})
  const editor = new EntryEditor(Product, node)
  render(
    <DashboardScopeInternal dashboard={testDashboard()}>
      <EditorScope editor={editor}>
        <EditField field={rating} />
      </EditorScope>
    </DashboardScopeInternal>
  )

  const input = screen.getByLabelText('Rating') as HTMLInputElement
  expect(input.value).toBe('3')
  expect(screen.getByText('From 1 to 5')).toBeDefined()
  expect(screen.getByText('rating:3 of Chair in no locale')).toBeDefined()

  fireEvent.change(input, {target: {value: '7'}})
  expect(screen.getByText('rating:7 of Chair in no locale')).toBeDefined()
  expect(screen.getByText('Too high')).toBeDefined()
})
