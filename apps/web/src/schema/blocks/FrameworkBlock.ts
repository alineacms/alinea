import {supportedFrameworks} from '@/layout/nav/Frameworks'
import {Config, Field} from 'alinea'
import {textField} from '../fields/TextField'

export const FrameworkBlock = Config.type('Framework specific', {
  fields: {
    ...Field.tabs(
      ...supportedFrameworks.map(framework => {
        return Field.tab(framework.label, {
          fields: {
            [framework.name]: textField()
          }
        })
      })
    )
  }
})
