import {Config, Field} from 'alinea'

export const Page = Config.document('Page', {
  fields: {},
  seo: {
    brandShareImage: Field.check('Brand the share image', {
      description: 'Add the site logo over the Open Graph image',
      initialValue: true
    })
  },
  details: {
    reviewer: Field.text('Reviewer', {width: 0.5}),
    stage: Field.select('Stage', {
      width: 0.5,
      options: {draft: 'Draft', review: 'In review', approved: 'Approved'}
    })
  }
})
