'use client'

import 'alinea/css'
import styler from '@alinea/styler'
import {Config, Field} from 'alinea'
import type {Field as AnyField} from 'alinea/core/Field'
import {createConfig} from 'alinea/core/Config'
import {Type} from 'alinea/core/Type'
import {NodeEditor} from 'alinea/dashboard/app/EntryFields'
import {ReactiveNode} from 'alinea/dashboard/atoms/ReactiveNode'
import {StoryProvider} from 'alinea/dashboard/StoryProvider'
import {views} from 'alinea/field/views'
import {type ReactNode, use, useMemo} from 'react'
import {DashboardTheme} from './DashboardTheme'
import type {FieldPreviewKey} from './fieldCatalog'
import css from './FieldPreviewRuntime.module.scss'

const styles = styler(css)

interface FieldPreviewDefinition {
  type: Type
  value?: Record<string, unknown>
  /** Links to entries of the demo content, which is loaded on demand */
  demo?: boolean
}

type Demo = Awaited<
  ReturnType<typeof import('@/page/demo/demoSetup').setupDemo>
>

let demo: Promise<Demo> | undefined

// One demo backend for every preview that links to entries, loaded and
// booted on first use
function loadDemo() {
  demo ??= Promise.all([
    import('@/page/demo/demoSetup'),
    fetch('/api/demo-source').then(response => response.json())
  ]).then(([{setupDemo}, exported]) => setupDemo(exported))
  return demo
}

// Fields that don't query content only need a workspace to render in
const previewConfig = createConfig({
  schema: {},
  workspaces: {
    preview: Config.workspace('Preview', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})

const maya = '3JjYfw4jxSLAyOGzbIzDbfrNHoT'
const chair = '3JjYfsX65WvXQnkwJOVR2RxDPxD'

const text = (value: string) => ({_type: 'text', text: value})

function row(id: string, type: string, index: string, data: object) {
  return {_id: id, _type: type, _index: index, ...data}
}

const localise = Field.localiser({locales: ['en', 'nl', 'fr']})

const Hero = Config.type('Hero', {fields: {title: Field.text('Title')}})
const Gallery = Config.type('Gallery', {fields: {title: Field.text('Title')}})
const TextBlock = Config.type('Text with image', {
  fields: {title: Field.text('Title')}
})

function single(field: AnyField) {
  return Config.type('Preview', {fields: {field}})
}

// Every card edits a single field of a type made for the preview, filled
// with a value that shows what editors work with
const definitions: Record<FieldPreviewKey, () => FieldPreviewDefinition> = {
  text: () => ({
    type: single(Field.text('Title')),
    value: {field: 'Summer collection'}
  }),
  richText: () => ({
    type: single(Field.richText('Body')),
    value: {
      field: [
        {_type: 'heading', level: 2, content: [text('Made for long days')]},
        {
          _type: 'paragraph',
          content: [
            text('Linen shirts and wool scarves, cut to last and made to be ')
          ]
        }
      ]
    }
  }),
  select: () => ({
    type: single(
      Field.select('Status', {
        options: {published: 'Published', draft: 'Draft'}
      })
    ),
    value: {field: 'published'}
  }),
  number: () => ({
    type: single(Field.number('Price', {minValue: 0})),
    value: {field: 49}
  }),
  check: () => ({
    type: single(Field.check('Navigation', {description: 'Show in the menu'})),
    value: {field: true}
  }),
  date: () => ({
    type: single(Field.date('Published on')),
    value: {field: '2026-09-23'}
  }),
  time: () => ({
    type: single(Field.time('Opens at')),
    value: {field: '09:30'}
  }),
  code: () => ({
    type: single(Field.code('Embed', {language: 'html'})),
    value: {
      field: '<iframe src="https://player.vimeo.com/video/7697"></iframe>'
    }
  }),
  path: () => ({
    // A path field is generated from the title next to it
    type: Config.type('Preview', {
      fields: {
        title: Field.text('Title', {hidden: true}),
        field: Field.path('Path')
      }
    }),
    value: {title: 'Summer collection', field: 'summer-collection'}
  }),
  link: () => ({
    type: single(Field.link('Call to action')),
    value: {
      field: {
        _id: 'cta',
        _type: 'url',
        _url: 'https://oakandloom.example/summer',
        _title: 'Shop now',
        _target: '_self'
      }
    }
  }),
  entry: () => ({
    type: single(Field.entry('Author')),
    value: {field: {_id: 'author', _type: 'entry', _entry: maya}},
    demo: true
  }),
  url: () => ({
    type: single(Field.url('Website')),
    value: {
      field: {
        _id: 'site',
        _type: 'url',
        _url: 'https://alineacms.com',
        _title: 'Alinea',
        _target: '_blank'
      }
    }
  }),
  image: () => ({
    type: single(Field.image('Hero image')),
    value: {field: {_id: 'hero', _type: 'image', _entry: chair}},
    demo: true
  }),
  file: () => ({
    type: single(Field.file('Press kit')),
    value: {field: {_id: 'press', _type: 'file', _entry: chair}},
    demo: true
  }),
  list: () => ({
    type: single(Field.list('Blocks', {schema: {Hero, TextBlock, Gallery}})),
    value: {
      field: [
        row('hero', 'Hero', 'a0', {title: 'Made for long days'}),
        row('text', 'TextBlock', 'a1', {title: 'Our materials'})
      ]
    }
  }),
  object: () => ({
    type: single(
      Field.object('Address', {
        fields: {
          street: Field.text('Street'),
          zip: Field.text('Postal code', {width: 0.4}),
          city: Field.text('City', {width: 0.6})
        }
      })
    ),
    value: {field: {street: 'Main street 12', zip: '1000', city: 'Brussels'}}
  }),
  tabs: () => ({
    type: Config.type('Preview', {
      fields: {
        ...Field.tabs(
          Field.tab('Content', {
            fields: {title: Field.text('Title')}
          }),
          Field.tab('SEO', {fields: {description: Field.text('Description')}}),
          Field.tab('Settings', {fields: {hidden: Field.check('Hidden')}})
        )
      }
    }),
    value: {title: 'Summer collection'}
  }),
  localiser: () => ({
    type: single(localise(Field.text('Headline'))),
    value: {
      field: {
        en: 'Made for long days',
        nl: 'Gemaakt voor lange dagen',
        fr: 'Fait pour les longues journées'
      }
    }
  })
}

export interface FieldPreviewRuntimeProps {
  field: FieldPreviewKey
}

/** Renders the real dashboard input of a field, loaded when it scrolls in */
export default function FieldPreviewRuntime({field}: FieldPreviewRuntimeProps) {
  const {type, node, demo} = useMemo(() => {
    const {type, value, demo} = definitions[field]()
    const initial = {...(Type.initialValue(type) as object), ...value}
    return {type, demo, node: new ReactiveNode(initial)}
  }, [field])
  const editor = <NodeEditor node={node} type={type} />
  return (
    <DashboardTheme className={styles.root(field)}>
      {demo ? (
        <DemoProvider>{editor}</DemoProvider>
      ) : (
        <StoryProvider views={views} config={previewConfig}>
          {editor}
        </StoryProvider>
      )}
    </DashboardTheme>
  )
}

interface DemoProviderProps {
  children: ReactNode
}

function DemoProvider({children}: DemoProviderProps) {
  const {config, client, db, events} = use(loadDemo())
  return (
    <StoryProvider
      config={config}
      client={client}
      graph={db}
      events={events}
      views={views}
    >
      {children}
    </StoryProvider>
  )
}
