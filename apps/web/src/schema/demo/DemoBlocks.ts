import {Config, Field} from 'alinea'

function linkWithLabel(label: string, width?: number) {
  return Field.link(label, {
    width,
    fields: {
      label: Field.text('Label')
    }
  })
}

function imageCredit() {
  return Field.text('Image credit', {
    help: 'Shown in small print, eg. "Photo by Jane Doe on Unsplash"'
  })
}

export const DemoHeroBlock = Config.type('Hero', {
  fields: {
    eyebrow: Field.text('Eyebrow', {width: 0.5}),
    layout: Field.select('Layout', {
      width: 0.5,
      initialValue: 'overlay',
      options: {
        overlay: 'Text over image',
        split: 'Image beside text'
      }
    }),
    title: Field.text('Title', {multiline: true, required: true}),
    text: Field.text('Text', {multiline: true}),
    image: Field.image('Image', {required: true}),
    credit: imageCredit(),
    link: linkWithLabel('Button')
  }
})

export const DemoFeaturedProductsBlock = Config.type('Featured products', {
  fields: {
    title: Field.text('Title', {width: 0.5}),
    link: linkWithLabel('Link', 0.5),
    products: Field.entry.multiple('Products', {
      condition: {_type: 'DemoProduct'},
      help: 'Pick three or four products to highlight'
    })
  }
})

export const DemoCollectionGridBlock = Config.type('Collection grid', {
  fields: {
    title: Field.text('Title'),
    text: Field.text('Text', {multiline: true}),
    collections: Field.entry.multiple('Collections', {
      condition: {_type: 'DemoCollection'}
    })
  }
})

export const DemoStoryBlock = Config.type('Image and text', {
  fields: {
    eyebrow: Field.text('Eyebrow', {width: 0.5}),
    imagePosition: Field.select('Image position', {
      width: 0.5,
      initialValue: 'left',
      options: {left: 'Left', right: 'Right'}
    }),
    title: Field.text('Title', {multiline: true}),
    text: Field.richText('Text'),
    image: Field.image('Image'),
    credit: imageCredit(),
    link: linkWithLabel('Link')
  }
})

export const DemoQuoteBlock = Config.type('Quote', {
  fields: {
    quote: Field.text('Quote', {multiline: true, required: true}),
    author: Field.text('Author', {width: 0.5}),
    source: Field.text('Source', {
      width: 0.5,
      help: 'Eg. a city or publication'
    })
  }
})

export const DemoJournalTeaserBlock = Config.type('Journal teaser', {
  fields: {
    title: Field.text('Title', {width: 0.5}),
    count: Field.number('Number of articles', {
      width: 0.5,
      initialValue: 3,
      minValue: 1,
      maxValue: 6
    }),
    link: linkWithLabel('Link')
  }
})

export const DemoStoresBlock = Config.type('Stores', {
  fields: {
    title: Field.text('Title'),
    stores: Field.list('Stores', {
      schema: {
        Store: Config.type('Store', {
          fields: {
            name: Field.text('Name', {width: 0.5}),
            phone: Field.text('Phone', {width: 0.5}),
            address: Field.text('Address', {multiline: true, width: 0.5}),
            hours: Field.text('Opening hours', {
              multiline: true,
              width: 0.5
            }),
            image: Field.image('Image'),
            note: Field.text('Note', {help: 'Eg. "Parking at the back"'})
          }
        })
      }
    })
  }
})

export const DemoNewsletterBlock = Config.type('Newsletter', {
  fields: {
    title: Field.text('Title'),
    text: Field.text('Text', {multiline: true}),
    buttonLabel: Field.text('Button label', {width: 0.5}),
    note: Field.text('Small print', {width: 0.5})
  }
})

export function demoBlocksField() {
  return Field.list('Blocks', {
    schema: {
      DemoHeroBlock,
      DemoFeaturedProductsBlock,
      DemoCollectionGridBlock,
      DemoStoryBlock,
      DemoQuoteBlock,
      DemoJournalTeaserBlock,
      DemoStoresBlock,
      DemoNewsletterBlock
    }
  })
}
