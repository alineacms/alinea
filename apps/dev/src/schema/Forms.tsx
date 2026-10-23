import {Config, Field, Form} from 'alinea'
import {IcRoundRule, IcRoundStarOutline} from 'alinea/dashboard/icons'

const Rating = Form.input('Rating', {
  icon: IcRoundStarOutline,
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

export const FormEntry = Config.document('Form', {
  icon: IcRoundRule,
  fields: {
    inputs: Field.form('Inputs', {
      inputs: {...Form.defaults, rating: Rating}
    })
  }
})
