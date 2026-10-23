import {Field, Form} from 'alinea'
import {IcRoundStarOutline} from 'alinea/dashboard/icons'

const Rating = Form.input('Rating', {
  icon: IcRoundStarOutline,
  kind: 'number',
  settings: {
    max: Field.number('Maximum', {initialValue: 5})
  },
  parse: ([raw]) => (raw ? Number(raw) : undefined),
  attributes: settings => ({type: 'number', min: 1, max: settings.max ?? 5}),
  validate: (value, settings) =>
    value < 1 || value > (settings.max ?? 5)
      ? `Choose 1 to ${settings.max ?? 5}`
      : undefined
})

export const FormEntry = Form.type('Form', {
  inputs: {...Form.defaults, rating: Rating}
})
