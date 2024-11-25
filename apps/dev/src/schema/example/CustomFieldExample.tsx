import {Config} from 'alinea'
import {position} from '../../field/PositionField'

export const CustomFieldExamples = Config.document('Custom field', {
  fields: {position: position('Position field')}
})
