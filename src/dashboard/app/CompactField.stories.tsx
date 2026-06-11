import {Field, type FieldOptions} from '#/core/Field.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {type} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {DashboardScopeInternal} from '#/dashboard/hooks.js'
import {Dashboard} from '#/dashboard/store.js'
import {check} from '#/field/check.js'
import {code} from '#/field/code.js'
import {date} from '#/field/date.js'
import {json} from '#/field/json.js'
import {list} from '#/field/list.js'
import {number} from '#/field/number.js'
import {object} from '#/field/object.js'
import {path} from '#/field/path.js'
import {richText} from '#/field/richtext.js'
import {select} from '#/field/select.js'
import {text} from '#/field/text.js'
import {time} from '#/field/time.js'
import '#/theme.css'
import {atom, type Atom} from 'jotai'
import type {ComponentType, CSSProperties, ReactNode} from 'react'
import {views} from '../../field/views.js'
import {Badge} from './Badge.js'
import {CompactField, CompactRecordFields} from './CompactField.js'

interface StoryDashboard {
  view(key: string): Atom<ComponentType | undefined>
}

const dashboard = {
  view(key) {
    return atom(() => views[key])
  }
} satisfies StoryDashboard as unknown as Dashboard

const featureType = type('Feature', {
  fields: {
    title: text('Title'),
    summary: text('Summary', {multiline: true}),
    priority: number('Priority')
  }
})

const compactCustomField = new ScalarField<string, FieldOptions<string>>({
  options: {label: 'Custom'},
  view: viewKeys.HiddenInput,
  compactView({value}) {
    return (
      <Badge appearance="background" size="small" status="success">
        Custom: {value}
      </Badge>
    )
  }
})

const fields: Array<{field: Field; label: string; value: unknown}> = [
  {
    label: 'Text',
    field: text('Headline'),
    value:
      'A long headline that should stay on one line and fade out cleanly inside a narrow table cell'
  },
  {label: 'Number', field: number('Score'), value: 1280},
  {label: 'Check', field: check('Published'), value: true},
  {label: 'Date', field: date('Date'), value: '2026-06-09'},
  {label: 'Time', field: time('Time'), value: '14:30'},
  {label: 'Path', field: path('Path'), value: 'features/compact-field-preview'},
  {
    label: 'Select',
    field: select('Status', {
      options: {draft: 'Draft', review: 'In review', live: 'Live'}
    }),
    value: 'review'
  },
  {
    label: 'Multi select',
    field: select.multiple('Channels', {
      options: {web: 'Web', app: 'App', email: 'Email'}
    }),
    value: ['web', 'email']
  },
  {
    label: 'Code',
    field: code('Snippet', {language: 'ts'}),
    value: 'export function compactField(value: unknown) { return value }'
  },
  {
    label: 'JSON',
    field: json('Payload'),
    value: {state: 'queued', retries: 2, tags: ['content', 'preview']}
  },
  {
    label: 'Rich text',
    field: richText('Body'),
    value: [
      {
        type: 'paragraph',
        content: [{type: 'text', text: 'Rich text body preview'}]
      }
    ]
  },
  {
    label: 'Object',
    field: object('Feature', {
      fields: {
        title: text('Title'),
        summary: text('Summary'),
        priority: number('Priority')
      }
    }),
    value: {
      title: 'Fast overview scanning',
      summary: 'A compact record preview',
      priority: 2
    }
  },
  {
    label: 'List',
    field: list('Features', {
      schema: {feature: featureType}
    }),
    value: [
      {
        _id: 'feature-1',
        _index: 'a0',
        _type: 'feature',
        title: 'Explorer table',
        summary: 'Compact values in columns',
        priority: 1
      },
      {
        _id: 'feature-2',
        _index: 'a1',
        _type: 'feature',
        title: 'Collapsed rows',
        summary: 'Footer preview for folded list rows',
        priority: 2
      }
    ]
  },
  {label: 'Custom', field: compactCustomField, value: 'Renderer'}
]

const storyStyle: CSSProperties = {
  maxWidth: 760,
  padding: 24
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '130px minmax(0, 1fr)',
  gap: '10px 14px',
  alignItems: 'center'
}

const cellStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden'
}

interface RowProps {
  children: ReactNode
  label: string
}

function Row({children, label}: RowProps) {
  return (
    <>
      <strong>{label}</strong>
      <div style={cellStyle}>{children}</div>
    </>
  )
}

export function AllFields() {
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <div style={storyStyle}>
        <div style={gridStyle}>
          {fields.map(({field, label, value}) => (
            <Row key={label} label={label}>
              <CompactField field={field} value={value} />
            </Row>
          ))}
        </div>
      </div>
    </DashboardScopeInternal>
  )
}

export function FooterLayout() {
  const recordFields = {
    quote: text('Quote'),
    author: text('Author')
  }
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <div style={{...storyStyle, maxWidth: 620}}>
        <CompactRecordFields
          fields={recordFields}
          layout="footer"
          value={{
            quote:
              'Content editing should stay close to the shape of the content.',
            author: 'Alinea'
          }}
        />
      </div>
    </DashboardScopeInternal>
  )
}

export function MultiSelectBadges() {
  const field = select.multiple('Channels', {
    options: {
      web: 'Web',
      app: 'App',
      email: 'Email',
      social: 'Social'
    }
  })
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <div style={{...storyStyle, maxWidth: 420}}>
        <Row label="Compact">
          <CompactField
            field={field}
            value={['web', 'app', 'email', 'social']}
          />
        </Row>
      </div>
    </DashboardScopeInternal>
  )
}

export default {
  title: 'Dashboard / CompactField'
}
