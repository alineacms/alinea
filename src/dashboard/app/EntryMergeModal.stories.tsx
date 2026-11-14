import {Button} from '#/components.js'
import {
  type EntryMerge,
  type EntryMergeLink,
  entryMerge
} from '#/dashboard/atoms/entryMerge.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {Config, Field} from '#/index.js'
import {useState} from 'react'
import {views} from '../../field/views.js'
import {EntryMergeModal} from './EntryMergeModal.js'

const Section = Config.type('Section', {
  fields: {title: Field.text('Title')}
})

const Page = Config.document('Page', {
  fields: {
    intro: Field.text('Intro'),
    summary: Field.text('Summary', {multiline: true}),
    servings: Field.number('Servings'),
    featured: Field.check('Featured'),
    body: Field.richText('Body'),
    sections: Field.list('Sections', {schema: {Section}}),
    link: Field.link('Link'),
    related: Field.entry.multiple('Related pages'),
    image: Field.image('Image'),
    ...Object.fromEntries(
      Array.from({length: 10}, (_, index) => [
        `field${index + 1}`,
        Field.text(`Field ${index + 1}`)
      ])
    )
  }
})

// A tiny image as the preview of the linked images
const preview = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`
  )}`

const links = new Map<string, EntryMergeLink>([
  ['home', {title: 'Home'}],
  ['about', {title: 'About us'}],
  ['contact', {title: 'Contact'}],
  ['shop', {title: 'Shop'}],
  ['tulips', {title: 'Tulips in the garden', preview: preview('#e0567a')}],
  ['ferns', {title: 'Ferns on a shelf', preview: preview('#3f8f5a')}]
])

function paragraphs(...lines: Array<string>) {
  return lines.map(text => ({
    _type: 'paragraph',
    content: [{_type: 'text', text}]
  }))
}

function section(id: number, title = `Section ${id}`) {
  return {_id: `section-${id}`, _index: `a${id}`, _type: 'Section', title}
}

function entry(id: string, target: string) {
  return {_id: id, _index: `a${id}`, _type: 'entry', _entry: target}
}

function image(target: string) {
  return {_id: 'image', _type: 'image', _entry: target}
}

type Values = Record<string, unknown>

interface Scenario {
  loaded: Values
  mine: Values
  theirs: Values
}

/** A merge where both changed each field mine sets */
function scenario({loaded, mine, theirs}: Scenario): EntryMerge {
  return entryMerge({
    type: Page,
    loaded,
    mine: {...loaded, ...mine},
    theirs: {...loaded, ...theirs},
    conflicts: Object.keys(mine).map(key => [key]),
    locale: null,
    links,
    name: 'Sam',
    date: Date.now() - 5 * 60_000
  })
}

const longText =
  'A very long description that goes on and on about the spring sale, the plants and pots on offer, the opening hours of the shop in town, the delivery options and the trees we plant for every order, so it never fits in a card.'

const simpleFields = scenario({
  loaded: {title: 'Spring', summary: 'Sale', servings: 4, featured: false},
  mine: {
    title: 'Spring sale starts Monday',
    summary: '',
    servings: 4,
    featured: true
  },
  theirs: {
    title: 'Spring sale',
    summary: 'Twenty percent off all plants and pots, this weekend only.',
    servings: 6,
    featured: false
  }
})

const listsAndRichText = scenario({
  loaded: {
    title: 'Spring',
    intro: 'Hello',
    body: paragraphs(
      'Our spring sale starts Monday.',
      'Come early, the best ones go first.'
    ),
    sections: [section(1), section(2), section(3)]
  },
  mine: {
    title: 'Spring sale starts Monday',
    body: paragraphs(
      'Our spring sale starts Monday with twenty percent off all plants.',
      'Come early, the best ones go first.'
    ),
    sections: [section(1, 'Opening hours'), section(2), section(3)]
  },
  theirs: {
    title: 'Spring sale',
    intro: 'Welcome to the spring sale',
    body: paragraphs(
      'Our spring sale starts Monday.',
      'Come early, the best ones go first.',
      'Delivery is free for orders over fifty euros.'
    ),
    sections: [section(1), section(3), section(4)]
  }
})

const linksAndImages = scenario({
  loaded: {
    featured: false,
    link: entry('link', 'home'),
    related: [entry('1', 'home')],
    image: image('tulips')
  },
  mine: {
    featured: true,
    link: entry('link', 'about'),
    related: [entry('1', 'home'), entry('2', 'about')],
    image: image('ferns')
  },
  theirs: {
    featured: false,
    link: {
      _id: 'link',
      _type: 'url',
      _url: 'https://example.com/spring',
      _title: 'Spring sale on example.com',
      _target: '_blank'
    },
    related: [entry('3', 'contact'), entry('4', 'shop')],
    image: null
  }
})

const manyFields = scenario({
  loaded: Object.fromEntries(
    Array.from({length: 10}, (_, index) => [`field${index + 1}`, 'Value'])
  ),
  mine: {
    ...Object.fromEntries(
      Array.from({length: 10}, (_, index) => [
        `field${index + 1}`,
        `My value ${index + 1}`
      ])
    ),
    sections: [section(1, 'Opening hours')]
  },
  theirs: {
    ...Object.fromEntries(
      Array.from({length: 10}, (_, index) => [
        `field${index + 1}`,
        `Their value ${index + 1}`
      ])
    ),
    sections: [section(2)]
  }
})

const longValues = scenario({
  loaded: {summary: '', intro: '', body: paragraphs('First line')},
  mine: {
    summary: longText,
    intro:
      'https://example.com/shop/spring-sale/plants-and-pots/twenty-percent-off/this-weekend-only?utm_source=newsletter',
    body: paragraphs(longText, 'Second paragraph', 'Third paragraph')
  },
  theirs: {
    summary: `${longText} ${longText}`,
    intro:
      'Supercalifragilisticexpialidociousplantsandpotsforeverybodyinthewholetown',
    body: paragraphs('First line', longText)
  }
})

interface MergeStoryProps {
  merge: EntryMerge
  publish?: boolean
}

function MergeStory({merge, publish}: MergeStoryProps) {
  const [result, setResult] = useState<string>()
  return (
    <StoryProvider views={views}>
      <EntryMergeModal
        merge={result ? undefined : merge}
        publish={publish}
        onApply={choices => setResult(JSON.stringify(choices))}
        onDiscard={() => setResult('Discarded')}
        onClose={() => setResult('Closed')}
      />
      {result && (
        <>
          <pre>{result}</pre>
          <Button onClick={() => setResult(undefined)}>Show again</Button>
        </>
      )}
    </StoryProvider>
  )
}

export function SimpleFields() {
  return <MergeStory merge={simpleFields} />
}

/** Review changes on Body or Sections opens the detail of the field */
export function ListsAndRichText() {
  return <MergeStory merge={listsAndRichText} />
}

export function LinksAndImages() {
  return <MergeStory merge={linksAndImages} />
}

export function ManyFields() {
  return <MergeStory merge={manyFields} />
}

export function LongValues() {
  return <MergeStory merge={longValues} />
}

export function Publish() {
  return <MergeStory merge={listsAndRichText} publish />
}

export default {
  title: 'Dashboard / EntryMergeModal'
}
