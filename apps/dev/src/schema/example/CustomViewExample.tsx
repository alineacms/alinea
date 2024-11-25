import {Config, Field} from 'alinea'

export const CustomViewExample = Config.document('Custom view', {
  fields: {
    ...Field.view('@/schema/example/CustomViewExample.view#CustomViewExample')
  }
})
