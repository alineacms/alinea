import {type} from '#/core/Type.js'
import {FieldsEditor} from '#/dashboard/app/Editor.js'
import {DashboardScopeInternal, EditorScope} from '#/dashboard/hooks.js'
import {
  Dashboard,
  DashboardEditor,
  ReactiveNode
} from '#/dashboard/store/Dashboard.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {atom, useAtomValue, type Atom} from 'jotai'
import {useMemo, type ComponentType} from 'react'
import {richText} from './RichTextField.js'
import {RichTextFieldView} from './RichTextField.view.js'

interface TestDashboard {
  view(key: string): Atom<ComponentType | undefined>
}

const ctaType = type('Call to action', {
  fields: {}
})

const noteType = type('Note', {
  fields: {}
})

const nestedCtaType = type('Call to action', {
  fields: {
    details: richText('Details', {
      schema: {
        Note: noteType
      }
    })
  }
})

const bodyField = richText('Body', {
  schema: {
    Cta: ctaType
  }
})

const nestedBodyField = richText('Body', {
  schema: {
    Cta: nestedCtaType
  }
})

const entryType = type('Entry', {
  fields: {
    body: bodyField
  }
})

const nestedEntryType = type('Entry', {
  fields: {
    body: nestedBodyField
  }
})

function createDashboard(): Dashboard {
  const views: Record<string, ComponentType> = {
    [viewKeys.RichTextInput]: RichTextFieldView as unknown as ComponentType
  }
  const dashboard = {
    view(key: string) {
      return atom(() => views[key])
    }
  } satisfies TestDashboard
  return dashboard as unknown as Dashboard
}

export function RichTextBlockEditingStory() {
  return <RichTextBlockStory initialBody={initialBody} type={entryType} />
}

export function RichTextNestedBlockStory() {
  return (
    <RichTextBlockStory
      initialBody={nestedInitialBody}
      type={nestedEntryType}
    />
  )
}

interface RichTextBlockStoryProps {
  initialBody: Array<object>
  type: typeof entryType | typeof nestedEntryType
}

function RichTextBlockStory({
  initialBody,
  type
}: RichTextBlockStoryProps) {
  const {dashboard, editor, node} = useMemo(() => {
    const dashboard = createDashboard()
    const node = new ReactiveNode<object>({
      body: initialBody
    })
    return {
      dashboard,
      node,
      editor: new DashboardEditor(dashboard, type, node)
    }
  }, [initialBody, type])
  const body = editor.field('body')
  if (!body) throw new Error('Body field not found')
  const bodyValue = useAtomValue(body.value)
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <EditorScope editor={editor}>
        <div id="alinea-toolbar" />
        <FieldsEditor />
        <pre data-testid="value">{JSON.stringify({body: bodyValue})}</pre>
      </EditorScope>
    </DashboardScopeInternal>
  )
}

const initialBody = [
  {
    _type: 'paragraph',
    content: [{_type: 'text', text: 'Before the block.'}]
  },
  {
    _id: 'cta-block',
    _type: 'Cta'
  },
  {
    _type: 'paragraph',
    content: [{_type: 'text', text: 'After the block.'}]
  }
]

const nestedInitialBody = [
  {
    _type: 'paragraph',
    content: [{_type: 'text', text: 'Before the block.'}]
  },
  {
    _id: 'cta-block',
    _type: 'Cta',
    details: [
      {
        _type: 'paragraph',
        content: [{_type: 'text', text: 'Nested details before note.'}]
      },
      {
        _id: 'note-block',
        _type: 'Note'
      },
      {
        _type: 'paragraph',
        content: [{_type: 'text', text: 'Nested details after note.'}]
      }
    ]
  },
  {
    _type: 'paragraph',
    content: [{_type: 'text', text: 'After the block.'}]
  }
]
