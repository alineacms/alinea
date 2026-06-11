import {Field} from '#/core/Field.js'
import {createId} from '#/core/Id.js'
import type {ListRow} from '#/core/ListRow.js'
import {Type, type, type Type as TypeInstance} from '#/core/Type.js'
import {generateNKeysBetween} from '#/core/util/FractionalIndexing.js'
import {DashboardScopeInternal, EditorScope} from '#/dashboard/hooks.js'
import {
  IcOutlineGridView,
  IcRoundCode,
  IcRoundDateRange,
  IcRoundFlashOn,
  IcRoundNorthEast,
  IcRoundPanorama
} from '#/dashboard/icons.js'
import {Dashboard, DashboardEditor, ReactiveNode} from '#/dashboard/store.js'
import {code} from '#/field/code.js'
import {date} from '#/field/date.js'
import {list} from '#/field/list.js'
import {number} from '#/field/number.js'
import {path} from '#/field/path.js'
import {text} from '#/field/text.js'
import '#/theme.css'
import {atom, type Atom} from 'jotai'
import type {ComponentType, CSSProperties} from 'react'
import {useMemo} from 'react'
import {views} from '../views.js'
import {ListFieldView} from './ListField.view.js'

function listRows<const Row extends {_type: string}>(
  rows: ReadonlyArray<Row>
): Array<Row & ListRow> {
  const keys = generateNKeysBetween(null, null, rows.length)
  return rows.map((row, index) => ({
    _id: createId(),
    _index: keys[index],
    ...row
  }))
}

const heroBlock = type('Hero', {
  icon: IcRoundPanorama,
  fields: {
    heading: text('Heading'),
    body: text('Body', {multiline: true})
  }
})

const quoteBlock = type('Quote', {
  fields: {
    quote: text('Quote', {multiline: true}),
    author: text('Author')
  }
})

const featureGridBlock = type('Feature Grid', {
  icon: IcOutlineGridView,
  fields: {
    title: text('Title'),
    intro: text('Intro', {multiline: true}),
    columns: number('Columns'),
    eyebrow: text('Eyebrow')
  }
})

const statBlock = type('Stat', {
  icon: IcRoundFlashOn,
  fields: {
    label: text('Label'),
    value: number('Value'),
    suffix: text('Suffix'),
    detail: text('Detail', {multiline: true})
  }
})

const timelineEventBlock = type('Timeline Event', {
  icon: IcRoundDateRange,
  fields: {
    title: text('Title'),
    date: date('Date'),
    summary: text('Summary', {multiline: true}),
    location: text('Location')
  }
})

const codeExampleBlock = type('Code Example', {
  icon: IcRoundCode,
  fields: {
    title: text('Title'),
    fileName: path('File name'),
    snippet: code('Snippet', {language: 'ts'}),
    notes: text('Notes', {multiline: true})
  }
})

const promoBannerBlock = type('Promo Banner', {
  icon: IcRoundNorthEast,
  fields: {
    heading: text('Heading'),
    body: text('Body', {multiline: true}),
    actionLabel: text('Action label'),
    actionPath: path('Action path')
  }
})

const faqItemBlock = type('FAQ Item', {
  fields: {
    question: text('Question'),
    answer: text('Answer', {multiline: true}),
    category: text('Category')
  }
})

const checklistItemBlock = type('Checklist Item', {
  fields: {
    label: text('Label'),
    detail: text('Detail', {multiline: true})
  }
})

const checklistBlock = type('Checklist', {
  icon: IcOutlineGridView,
  fields: {
    title: text('Title'),
    intro: text('Intro', {multiline: true}),
    items: list('Items', {
      schema: {
        checklistItem: checklistItemBlock
      },
      initialValue: [
        {
          _type: 'checklistItem',
          label: 'Define the content model',
          detail: 'Name the block types editors can add to the page.'
        },
        {
          _type: 'checklistItem',
          label: 'Add useful defaults',
          detail:
            'Seed nested rows so empty states and populated states are visible.'
        }
      ]
    })
  }
})

const campaignBlock = type('Campaign', {
  icon: IcRoundNorthEast,
  fields: {
    name: text('Name'),
    slug: path('Slug', {from: 'name'}),
    eyebrow: text('Eyebrow'),
    headline: text('Headline'),
    summary: text('Summary', {multiline: true}),
    audience: text('Audience'),
    owner: text('Owner'),
    startsAt: date('Starts at'),
    endsAt: date('Ends at'),
    priority: number('Priority'),
    budget: number('Budget'),
    actionLabel: text('Action label'),
    actionPath: path('Action path', {from: 'actionLabel'}),
    trackingCode: code('Tracking code', {language: 'json'}),
    internalNotes: text('Internal notes', {multiline: true})
  }
})

const pageType = type('Page', {
  fields: {
    sections: list('Sections', {
      schema: {
        hero: heroBlock,
        quote: quoteBlock,
        featureGrid: featureGridBlock,
        stat: statBlock,
        timelineEvent: timelineEventBlock,
        codeExample: codeExampleBlock,
        promoBanner: promoBannerBlock,
        faqItem: faqItemBlock,
        checklist: checklistBlock,
        campaign: campaignBlock
      },
      initialValue: [
        {
          _type: 'hero',
          heading: 'Build structured pages',
          body: 'Compose reusable content sections with a list field.'
        },
        {
          _type: 'quote',
          quote:
            'Content editing should stay close to the shape of the content.',
          author: 'Alinea'
        },
        {
          _type: 'faqItem',
          question: 'Can editors reorder blocks?',
          answer:
            'Yes. Rows can be dragged, moved with buttons, or inserted between existing blocks.',
          category: 'Editing'
        },
        {
          _type: 'checklist',
          title: 'Launch checklist',
          intro: 'A nested list inside a list row.',
          items: listRows([
            {
              _type: 'checklistItem',
              label: 'Draft sections',
              detail: 'Create the initial set of content blocks.'
            },
            {
              _type: 'checklistItem',
              label: 'Review responsive layout',
              detail: 'Open rows and confirm the nested list remains usable.'
            }
          ])
        },
        {
          _type: 'campaign',
          name: 'Spring release',
          slug: 'spring-release',
          eyebrow: 'Product update',
          headline: 'A denser block for long editing forms',
          summary:
            'This row includes many fields so the list field can be checked with a heavier editing surface.',
          audience: 'Existing customers',
          owner: 'Content team',
          startsAt: '2026-03-01',
          endsAt: '2026-04-15',
          priority: 2,
          budget: 12500,
          actionLabel: 'Read the release notes',
          actionPath: '/releases/spring',
          trackingCode: '{"campaign":"spring-release","channel":"dashboard"}',
          internalNotes:
            'Use this row to verify spacing, overview labels, and dense field layouts.'
        }
      ]
    })
  }
})

const storyStyle: CSSProperties = {
  maxWidth: 760,
  padding: 24
}

interface StoryDashboard {
  view(key: string): Atom<ComponentType | undefined>
}

const dashboard = {
  view(key) {
    return atom(() => views[key])
  }
} satisfies StoryDashboard as unknown as Dashboard

export function Example() {
  const editor = useMemo(() => {
    const node = new ReactiveNode(Type.initialValue(pageType) as object)
    return new DashboardEditor(dashboard, pageType as TypeInstance, node)
  }, [])
  const sections = Field.isField(pageType.sections) ? pageType.sections : null
  if (!sections) return null
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <EditorScope editor={editor}>
        <div style={storyStyle}>
          <ListFieldView field={sections} />
        </div>
      </EditorScope>
    </DashboardScopeInternal>
  )
}

export default {
  title: 'Fields / ListField'
}
