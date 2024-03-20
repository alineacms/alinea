import {Config, Field} from 'alinea'

export const InlineFields = Config.document('Inline fields', {
  fields: {
    street: Field.text('Street', {
      width: 0.6,
      inline: true,
      multiline: true
    }),
    streetNr: Field.text('Number', {width: 0.2, inline: true}),
    box: Field.text('Box', {width: 0.2, inline: true}),
    zip: Field.text('Zipcode', {width: 0.2, inline: true}),
    city: Field.text('City', {width: 0.4, inline: true}),
    country: Field.text('Country', {
      width: 0.4,
      inline: true
    })
  }
})
