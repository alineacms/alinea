import {Field} from '#/core/Field.js'
import {Type, type, type Type as TypeInstance} from '#/core/Type.js'
import {
  IcOutlineGridView,
  IcRoundCode,
  IcRoundDateRange,
  IcRoundFlashOn,
  IcRoundNorthEast,
  IcRoundPanorama
} from '#/dashboard/icons.js'
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
import {Dashboard, DashboardEditor, ReactiveNode} from '../../../store.js'
import {DashboardScopeInternal, EditorScope} from '../../../store/hooks.js'
import {views} from '../views.js'
import {ListFieldView} from './ListField.view.js'

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
        faqItem: faqItemBlock
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
