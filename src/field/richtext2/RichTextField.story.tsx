import {type} from '#/core/Type.js'
import {FieldsEditor} from '#/dashboard/app/Editor.js'
import {DashboardScopeInternal, EditorScope} from '#/dashboard/hooks.js'
import {
  Dashboard,
  DashboardEditor,
  ReactiveNode
} from '#/dashboard/store/Dashboard.js'
import {richText} from '#/field/richtext/RichTextField.js'
import {check} from '#/field/check.js'
import {code} from '#/field/code.js'
import {select} from '#/field/select.js'
import {text} from '#/field/text/TextField.js'
import {atom, useAtomValue} from 'jotai'
import {useMemo} from 'react'
import {views} from '../views.js'

const note = type('Note', {
  fields: {text: text('Text', {multiline: true})}
})

const callout = type('Callout', {
  fields: {
    title: text('Title'),
    details: richText('Details', {schema: {Note: note}})
  }
})

const cta = type('Call to action', {
  fields: {
    title: text('CTA title'),
    text: text('CTA text', {multiline: true}),
    actionCode: code('Action code', {language: 'ts'}),
    variant: select('Variant', {
      options: {
        primary: 'Primary',
        secondary: 'Secondary',
        subtle: 'Subtle'
      },
      initialValue: 'primary'
    }),
    targets: select.multiple('Targets', {
      options: {header: 'Header', sidebar: 'Sidebar', footer: 'Footer'},
      initialValue: ['header', 'footer']
    }),
    details: richText('CTA details', {schema: {Note: note}}),
    featured: check('Featured')
  }
})

const body = richText('Body', {
  schema: {Callout: callout, Cta: cta},
  enableTables: true
})
const entry = type('Entry', {fields: {body}})
const plainBody = richText('Body', {enableTables: true})
const plainEntry = type('Plain entry', {fields: {body: plainBody}})
const readOnlyBody = richText('Body', {
  schema: {Callout: callout, Cta: cta},
  enableTables: true,
  readOnly: true
})
const readOnlyEntry = type('Read-only entry', {fields: {body: readOnlyBody}})

export function RichText2Story() {
  return <RichText2Fixture initialBody={blocksValue} entryType={entry} />
}

export function RichText2PlainStory() {
  return (
    <RichText2Fixture
      initialBody={[
        paragraph('Select this text to try headings, formatting and links.'),
        paragraph('Press Enter to create another paragraph and test history.')
      ]}
      entryType={plainEntry}
    />
  )
}

export function RichText2EmptyStory() {
  return <RichText2Fixture initialBody={[]} entryType={plainEntry} />
}

export function RichText2ReadOnlyStory() {
  return (
    <RichText2Fixture initialBody={blocksValue} entryType={readOnlyEntry} />
  )
}

interface RichText2FixtureProps {
  initialBody: Array<object>
  entryType: typeof entry | typeof plainEntry | typeof readOnlyEntry
}

function RichText2Fixture({initialBody, entryType}: RichText2FixtureProps) {
  const state = useMemo(() => {
    const dashboard = createDashboard()
    const node = new ReactiveNode<object>({body: initialBody})
    return {
      dashboard,
      editor: new DashboardEditor(dashboard, entryType, node)
    }
  }, [entryType, initialBody])
  const field = state.editor.field('body')
  if (!field) throw new Error('Body field not found')
  const value = useAtomValue(field.value)
  return (
    <DashboardScopeInternal dashboard={state.dashboard}>
      <EditorScope editor={state.editor}>
        <div id="alinea-toolbar" />
        <FieldsEditor />
        <pre data-testid="value">{JSON.stringify(value)}</pre>
      </EditorScope>
    </DashboardScopeInternal>
  )
}

function createDashboard(): Dashboard {
  const dashboard = {
    view(key: string) {
      return atom(() => views[key])
    }
  }
  return dashboard as unknown as Dashboard
}

function paragraph(text: string) {
  return {
    _type: 'paragraph',
    content: [{_type: 'text', text}]
  }
}

const blocksValue = [
  paragraph('Before the block.'),
  {
    _type: 'Callout',
    _id: 'callout-1',
    title: 'Important',
    details: [paragraph('Nested details.')]
  },
  paragraph('After the block.')
]
