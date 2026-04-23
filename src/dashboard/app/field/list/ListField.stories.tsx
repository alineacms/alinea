import {Field} from '#/core/Field.js'
import {Type, type, type Type as TypeInstance} from '#/core/Type.js'
import {list} from '#/field/list.js'
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

const pageType = type('Page', {
  fields: {
    sections: list('Sections', {
      schema: {
        hero: heroBlock,
        quote: quoteBlock
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
    return atom(views[key])
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
