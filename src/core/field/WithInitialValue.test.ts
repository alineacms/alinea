import {BlockNode, Node} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

const button = {
  _id: 'button',
  _index: 'a0',
  _type: 'url',
  _url: 'https://example.com',
  _title: 'Example',
  _target: '_self'
}

function buttonFields() {
  return {
    variant: Field.select('Variant', {
      options: {accent: 'Accent', secondary: 'Secondary', link: 'Link'},
      initialValue: 'accent'
    })
  }
}

test('initializes fields nested in an object', () => {
  const Buttons = Config.type('Buttons', {
    fields: {buttons: Field.link.multiple('Buttons', {fields: buttonFields()})}
  })
  const ImageText = Config.type('Image & Text', {
    fields: {
      content: Field.object('Content', {
        fields: {text: Field.richText('Text', {schema: {Buttons}})}
      })
    }
  })
  const Page = Config.type('Page', {
    fields: {body: Field.richText('Body', {schema: {ImageText}})}
  })
  const buttons = {
    [Node.type]: 'Buttons',
    [BlockNode.id]: 'buttons',
    buttons: [button]
  }

  const value = Type.withInitialValue(Page, {
    body: [
      {
        [Node.type]: 'ImageText',
        [BlockNode.id]: 'image-text',
        content: {text: [buttons]}
      }
    ]
  }) as {
    body: Array<{
      content: {text: Array<{buttons: Array<Record<string, unknown>>}>}
    }>
  }

  test.is(value.body[0].content.text[0].buttons[0].variant, 'accent')
})

test('initializes fields nested in a single link', () => {
  const Page = Config.type('Page', {
    fields: {button: Field.link('Button', {fields: buttonFields()})}
  })

  const value = Type.withInitialValue(Page, {button}) as {
    button: Record<string, unknown>
  }

  test.is(value.button.variant, 'accent')
})

test('initializes fields nested in a multiple link', () => {
  const Page = Config.type('Page', {
    fields: {
      buttons: Field.link.multiple('Buttons', {fields: buttonFields()})
    }
  })

  const value = Type.withInitialValue(Page, {buttons: [button]}) as {
    buttons: Array<Record<string, unknown>>
  }

  test.is(value.buttons[0].variant, 'accent')
})

test('initializes fields nested in a list', () => {
  const Item = Config.type('Item', {
    fields: {variant: Field.text('Variant', {initialValue: 'accent'})}
  })
  const Page = Config.type('Page', {
    fields: {items: Field.list('Items', {schema: {Item}})}
  })

  const value = Type.withInitialValue(Page, {
    items: [{_id: 'item', _index: 'a0', _type: 'Item'}]
  }) as {items: Array<Record<string, unknown>>}

  test.is(value.items[0].variant, 'accent')
})

test('initializes fields nested in a rich text block', () => {
  const Block = Config.type('Block', {
    fields: {title: Field.text('Title')}
  })
  const Page = Config.type('Page', {
    fields: {body: Field.richText('Body', {schema: {Block}})}
  })

  const value = Type.withInitialValue(Page, {
    body: [{[Node.type]: 'Block', [BlockNode.id]: 'block'}]
  }) as {body: Array<{title: string}>}

  test.is(value.body[0].title, '')
})
