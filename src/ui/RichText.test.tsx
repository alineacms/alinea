import {cleanup, render, screen, within} from '#test/react.js'
import type {TextDoc} from 'alinea/core/TextDoc'
import {afterEach, expect, test} from 'bun:test'
import type {ComponentPropsWithoutRef, PropsWithChildren} from 'react'
import {RichText, type RichTextProps} from './RichText.js'

afterEach(cleanup)

test('RichText renders paragraphs, headings, lists, quotes and rules', () => {
  const doc = [
    {
      _type: 'heading',
      level: 2,
      content: [{_type: 'text', text: 'Hello world'}]
    },
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'Intro'}]
    },
    {
      _type: 'bulletList',
      content: [
        {
          _type: 'listItem',
          content: [
            {_type: 'paragraph', content: [{_type: 'text', text: 'One'}]}
          ]
        }
      ]
    },
    {
      _type: 'blockquote',
      content: [{_type: 'paragraph', content: [{_type: 'text', text: 'Quote'}]}]
    },
    {_type: 'horizontalRule'}
  ] satisfies TextDoc

  const {container} = render(<RichText doc={doc} />)

  const heading = screen.getByRole('heading', {level: 2, name: 'Hello world'})
  expect(heading.id).toBe('hello-world')
  expect(screen.getByText('Intro').tagName).toBe('P')
  expect(screen.getByRole('listitem').textContent).toBe('One')
  expect(container.querySelector('blockquote')?.textContent).toBe('Quote')
  expect(container.querySelector('hr')).not.toBeNull()
})

test('RichText renders text marks and link attributes', () => {
  const doc = [
    {
      _type: 'paragraph',
      content: [
        {
          _type: 'text',
          text: 'Marked',
          marks: [
            {_type: 'bold'},
            {_type: 'italic'},
            {
              _type: 'link',
              href: 'https://example.com',
              target: '_blank',
              title: 'Example'
            }
          ]
        }
      ]
    }
  ] satisfies TextDoc

  const {container} = render(<RichText doc={doc} />)

  const link = screen.getByRole('link', {name: 'Marked'})
  expect(link.getAttribute('href')).toBe('https://example.com')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('title')).toBe('Example')
  expect(container.querySelector('a > i > b')?.textContent).toBe('Marked')
})

test('RichText renders tables with spans', () => {
  const doc = [
    {
      _type: 'table',
      content: [
        {
          _type: 'tableBody',
          content: [
            {
              _type: 'tableRow',
              content: [
                {
                  _type: 'tableHeader',
                  colspan: 2,
                  content: [
                    {
                      _type: 'paragraph',
                      content: [{_type: 'text', text: 'Name'}]
                    }
                  ]
                },
                {
                  _type: 'tableCell',
                  rowspan: 2,
                  content: [
                    {
                      _type: 'paragraph',
                      content: [{_type: 'text', text: 'Value'}]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ] satisfies TextDoc

  const {container} = render(<RichText doc={doc} />)

  const table = container.querySelector('table')
  expect(table).not.toBeNull()
  const header = within(table!).getByText('Name').closest('th')
  const cell = within(table!).getByText('Value').closest('td')
  expect(header?.colSpan).toBe(2)
  expect(cell?.rowSpan).toBe(2)
})

test('RichText supports custom HTML views for elements and text', () => {
  const doc = [
    {
      _type: 'heading',
      level: 2,
      content: [{_type: 'text', text: 'Title'}]
    },
    {
      _type: 'paragraph',
      textAlign: 'right',
      content: [{_type: 'text', text: 'Custom'}]
    }
  ] satisfies TextDoc
  let headingLevel: unknown
  function H2({
    children,
    ...props
  }: ComponentPropsWithoutRef<'h2'> & {level?: unknown}) {
    headingLevel = props.level
    return (
      <h2 data-testid="heading" {...props}>
        {children}
      </h2>
    )
  }
  function P({children, ...props}: ComponentPropsWithoutRef<'p'>) {
    return (
      <section data-testid="paragraph" {...props}>
        {children}
      </section>
    )
  }
  function Text({children}: {children?: string}) {
    return <span data-testid="text">{children}</span>
  }

  render(<RichText doc={doc} h2={H2} p={P} text={Text} />)

  expect(screen.getByTestId('heading').tagName).toBe('H2')
  expect(screen.getByTestId('heading').id).toBe('title')
  expect(headingLevel).toBeUndefined()
  expect(screen.getByTestId('paragraph').tagName).toBe('SECTION')
  expect(screen.getByTestId('paragraph').style.textAlign).toBe('right')
  expect(
    screen.getAllByTestId('text').map(element => element.textContent)
  ).toEqual(['Title', 'Custom'])
})

test('RichText supports custom HTML views for marks and React elements', () => {
  const doc = [
    {
      _type: 'paragraph',
      content: [
        {
          _type: 'text',
          text: 'Important',
          marks: [{_type: 'bold'}, {_type: 'small'}]
        }
      ]
    }
  ] satisfies TextDoc
  function Bold({children}: PropsWithChildren) {
    return <strong data-testid="bold">{children}</strong>
  }

  render(
    <RichText
      doc={doc}
      b={Bold}
      small={<em data-testid="small" className="quiet" />}
    />
  )

  expect(screen.getByTestId('bold').tagName).toBe('STRONG')
  expect(screen.getByTestId('small').className).toBe('quiet')
  expect(screen.getByTestId('small').textContent).toBe('Important')
})

test('RichText renders inline elements and alignment attributes', () => {
  const doc = [
    {
      _type: 'paragraph',
      textAlign: 'center',
      content: [
        {_type: 'text', text: 'Line one'},
        {_type: 'hardBreak'},
        {
          _type: 'text',
          text: 'Two',
          marks: [{_type: 'subscript'}, {_type: 'superscript'}]
        }
      ]
    }
  ] satisfies TextDoc

  const {container} = render(<RichText doc={doc} />)

  const paragraph = screen.getByText('Line one').closest('p')
  expect(paragraph?.style.textAlign).toBe('center')
  expect(container.querySelector('br')).not.toBeNull()
  expect(container.querySelector('sup > sub')?.textContent).toBe('Two')
})

test('RichText uses provided heading ids and ignores left alignment', () => {
  const doc = [
    {
      _type: 'heading',
      level: 3,
      id: 'custom-id',
      textAlign: 'left',
      content: [{_type: 'text', text: 'Custom heading'}]
    }
  ] satisfies TextDoc

  const heading = render(<RichText doc={doc} />).getByRole('heading', {
    level: 3,
    name: 'Custom heading'
  })

  expect(heading.id).toBe('custom-id')
  expect(heading.style.textAlign).toBe('')
})

test('RichText renders custom block nodes', () => {
  interface Blocks {
    Callout: {message: string}
  }
  const doc = [
    {
      _type: 'Callout',
      _id: 'callout-1',
      message: 'Read this'
    }
  ] satisfies TextDoc<Blocks>
  function Callout({message}: {message: string}) {
    return <aside data-testid="callout">{message}</aside>
  }
  const props = {doc, Callout} satisfies RichTextProps<Blocks>

  render(<RichText<Blocks> {...props} />)

  expect(screen.getByTestId('callout').textContent).toBe('Read this')
})

test('RichText renders nothing for invalid docs and unknown blocks', () => {
  const {container, rerender} = render(
    <RichText doc={null as unknown as TextDoc} />
  )
  expect(container.textContent).toBe('')

  rerender(<RichText doc={[{_type: 'Unknown', _id: '1'}]} />)
  expect(container.textContent).toBe('')
})
