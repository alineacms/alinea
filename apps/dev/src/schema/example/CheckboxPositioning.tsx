import {Config, Field} from 'alinea'

export const CheckboxPositioning = Config.document('Checkbox positioning', {
  fields: {
    plain: Field.check('Plain checkbox label'),
    required: Field.check('Required checkbox label', {
      required: true
    }),
    shared: Field.check('Shared checkbox label', {
      shared: true
    }),
    requiredShared: Field.check('Required shared checkbox label', {
      required: true,
      shared: true
    }),
    withDescription: Field.check('Checkbox with description', {
      description: 'This text should stay next to the checkbox.',
      required: true,
      shared: true
    }),
    withHelpAndDescription: Field.check(
      'Checkbox with help & description text',
      {
        help: 'Help text should render above the checkbox row.',
        description: 'This text should stay next to the checkbox.',
        required: true,
        shared: true
      }
    ),
    withHelpNoDescription: Field.check(
      'Checkbox with help but without description text',
      {
        help: 'Help renders in the description position.',
        required: true,
        shared: true
      }
    )
  }
})
