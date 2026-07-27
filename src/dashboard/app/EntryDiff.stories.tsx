import '#/theme.css'
import {atom} from 'jotai'
import {useMemo, useState, type CSSProperties} from 'react'
import {
  EntryDiff,
  type EntryDiffField,
  type EntryDiffResolutions
} from './EntryDiff.js'

const storyStyle: CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  padding: 32,
  background: 'var(--alinea-backdrop)',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
}

const revisionFields: Array<EntryDiffField> = [
  {
    id: 'title',
    label: 'Title',
    baseValue: 'A calmer way to manage content',
    localValue: 'A faster, calmer way to manage content'
  },
  {
    id: 'summary',
    label: 'Summary',
    baseValue: 'Bring your content and your team together in one workspace.',
    localValue:
      'Bring your structured content and your whole team together in one workspace.'
  },
  {
    id: 'featured',
    label: 'Featured',
    baseValue: false,
    localValue: true
  }
]

const conflictFields: Array<EntryDiffField> = [
  {
    id: 'title',
    label: 'Title',
    baseValue: 'A calmer way to manage content',
    localValue: 'A calmer way to publish content',
    serverValue: 'The calmer way to manage content'
  },
  {
    id: 'summary',
    label: 'Summary',
    baseValue: 'Bring your content and your team together in one workspace.',
    localValue:
      'Bring your structured content and your team together in one workspace.',
    serverValue:
      'Bring your content and your whole team together in one shared workspace.'
  },
  {
    id: 'audience',
    label: 'Audience',
    baseValue: 'Developers',
    localValue: 'Content teams',
    serverValue: 'Developers'
  },
  {
    id: 'callout',
    label: 'Callout',
    baseValue: 'Start building today',
    localValue: 'Start building today',
    serverValue: 'Explore the new editor today'
  },
  {
    id: 'relatedLink',
    label: 'Related link',
    valueKind: 'link',
    baseValue: {
      _id: 'link-docs',
      _type: 'url',
      _url: 'https://alinea.sh/docs',
      _title: 'Alinea documentation'
    },
    localValue: {
      _id: 'link-docs',
      _type: 'url',
      _url: 'https://alinea.sh/docs/content-model',
      _title: 'Content modelling guide'
    },
    serverValue: {
      _id: 'link-docs',
      _type: 'url',
      _url: 'https://alinea.sh/docs/getting-started',
      _title: 'Get started with Alinea'
    }
  },
  {
    id: 'sections',
    label: 'Sections',
    valueKind: 'list',
    baseValue: [
      {
        _id: 'section-welcome',
        _type: 'callout',
        heading: 'Welcome',
        text: 'A calmer way to manage content.'
      },
      {
        _id: 'section-next',
        _type: 'callout',
        heading: 'Next step',
        text: 'Start building your content model.'
      }
    ],
    localValue: [
      {
        _id: 'section-welcome',
        _type: 'callout',
        heading: 'Welcome',
        text: 'A faster way to manage structured content.'
      },
      {
        _id: 'section-next',
        _type: 'callout',
        heading: 'Next step',
        text: 'Start building your content model.'
      },
      {
        _id: 'section-teams',
        _type: 'callout',
        heading: 'Built for teams',
        text: 'Review and publish together.'
      }
    ],
    serverValue: [
      {
        _id: 'section-welcome',
        _type: 'callout',
        heading: 'Meet Alinea',
        text: 'A calmer way to manage content.'
      },
      {
        _id: 'section-proof',
        _type: 'callout',
        heading: 'Loved by editors',
        text: 'Give every contributor a focused workspace.'
      }
    ]
  },
  {
    id: 'body',
    label: 'Body',
    valueKind: 'richText',
    baseValue: [
      {
        _type: 'heading',
        level: 2,
        content: [{_type: 'text', text: 'A content workflow for everyone'}]
      },
      {
        _type: 'paragraph',
        content: [
          {
            _type: 'text',
            text: 'Model content, invite your team, and publish with confidence.'
          }
        ]
      }
    ],
    localValue: [
      {
        _type: 'heading',
        level: 2,
        content: [
          {_type: 'text', text: 'A content workflow for your whole team'}
        ]
      },
      {
        _type: 'paragraph',
        content: [
          {
            _type: 'text',
            text: 'Model structured content, invite your team, and publish with confidence.'
          }
        ]
      }
    ],
    serverValue: [
      {
        _type: 'heading',
        level: 2,
        content: [{_type: 'text', text: 'One workflow, from draft to publish'}]
      },
      {
        _type: 'paragraph',
        content: [
          {
            _type: 'text',
            text: 'Model content, collaborate with your team, and publish with confidence.'
          }
        ]
      },
      {
        _type: 'blockquote',
        content: [
          {
            _type: 'paragraph',
            content: [
              {_type: 'text', text: 'Content stays clear at every stage.'}
            ]
          }
        ]
      }
    ]
  }
]

export function RevisionOverview() {
  return (
    <main style={storyStyle}>
      <EntryDiff
        columnLabels={{
          left: 'Revision from 12 July 2026, 14:32',
          right: 'Current draft'
        }}
        fields={revisionFields}
      />
    </main>
  )
}

export function ConflictResolution() {
  const resolutionsAtom = useMemo(() => atom<EntryDiffResolutions>({}), [])
  const [result, setResult] = useState<Record<string, unknown>>()
  return (
    <main style={storyStyle}>
      <EntryDiff
        columnLabels={{left: 'You', right: 'Server'}}
        fields={conflictFields}
        mode="resolve"
        resolutionsAtom={resolutionsAtom}
        onApply={setResult}
      />
      {result && (
        <pre
          style={{
            width: 'min(100%, 960px)',
            boxSizing: 'border-box',
            margin: '16px 0 0',
            padding: 16,
            border: '1px solid var(--alinea-border)',
            borderRadius: 8,
            background: 'var(--alinea-bg)',
            color: 'var(--alinea-fg)',
            whiteSpace: 'pre-wrap'
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  )
}

export default {
  title: 'Dashboard / Entry diff'
}
