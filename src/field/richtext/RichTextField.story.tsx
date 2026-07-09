import {type} from '#/core/Type.js'
import {FieldsEditor} from '#/dashboard/app/Editor.js'
import {DashboardScopeInternal, EditorScope} from '#/dashboard/hooks.js'
import {
  Dashboard,
  DashboardEditor,
  ReactiveNode
} from '#/dashboard/store/Dashboard.js'
import {atom, useAtomValue, type Atom} from 'jotai'
import {useMemo, type ComponentType} from 'react'
import {check} from '../check/CheckField.js'
import {code} from '../code/CodeField.js'
import {select} from '../select/SelectField.js'
import {text} from '../text/TextField.js'
import {views} from '../views.js'
import {richText} from './RichTextField.js'

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

const fixtureNoteType = type('Note', {
  fields: {
    text: text('Text', {
      multiline: true,
      placeholder: 'Add a nested note'
    })
  }
})

const fixtureCtaType = type('Call to action', {
  fields: {
    title: text('Title'),
    text: text('Text', {
      multiline: true,
      placeholder: 'Write a short prompt'
    }),
    actionCode: code('Action code', {
      language: 'ts'
    }),
    variant: select('Variant', {
      options: {
        primary: 'Primary',
        secondary: 'Secondary',
        subtle: 'Subtle'
      },
      initialValue: 'primary'
    }),
    targets: select.multiple('Targets', {
      options: {
        header: 'Header',
        sidebar: 'Sidebar',
        footer: 'Footer'
      },
      initialValue: ['header', 'footer']
    }),
    details: richText('Details', {
      schema: {
        Note: fixtureNoteType
      }
    }),
    featured: check('Featured')
  }
})

const fixtureQuoteType = type('Quote', {
  fields: {
    quote: text('Quote', {
      multiline: true,
      placeholder: 'Add a quote'
    }),
    attribution: text('Attribution')
  }
})

const fixtureBodyField = richText('Body', {
  schema: {
    Cta: fixtureCtaType,
    Quote: fixtureQuoteType
  }
})

const fixtureType = type('Entry', {
  fields: {
    body: fixtureBodyField
  }
})

function createDashboard(): Dashboard {
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

export function RichTextFixtureBlocksStory() {
  return <RichTextBlockStory initialBody={fixtureBlocksBody} type={fixtureType} />
}

interface RichTextBlockStoryProps {
  initialBody: Array<object>
  type: typeof entryType | typeof nestedEntryType | typeof fixtureType
}

function RichTextBlockStory({initialBody, type}: RichTextBlockStoryProps) {
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

const fixtureBlocksBody = [
  {
    _type: 'paragraph',
    content: [
      {
        _type: 'text',
        text: 'This fixture page includes rich text blocks so the v2 insert menu has something real to work with.'
      }
    ]
  },
  {
    _type: 'Cta',
    _id: 'fixture-cta-block',
    title: 'Try inserting another block',
    text: 'Use the insert menu to add more blocks between text fragments.',
    actionCode: "router.push('/docs/blocks')",
    variant: 'primary',
    targets: ['header', 'footer'],
    details: [],
    featured: true
  },
  {
    _type: 'paragraph',
    content: [
      {
        _type: 'text',
        text: 'The quote below is another rich text block instance stored inline with the document.'
      }
    ]
  },
  {
    _type: 'Quote',
    _id: 'fixture-quote-block',
    quote:
      'Blocks should feel like first-class parts of the document, not a bolted-on exception.',
    attribution: 'Fixture content'
  }
]
