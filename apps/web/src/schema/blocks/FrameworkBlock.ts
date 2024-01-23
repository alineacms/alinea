import {supportedFrameworks} from '@/layout/nav/Frameworks'
import alinea from 'alinea'
import {textField} from './TextBlock'

export const FrameworkBlock = alinea.type('Framework specific', {
  ...alinea.tabs(
    ...supportedFrameworks.map(framework => {
      return alinea.tab(framework.label, {
        [framework.name]: textField()
      })
    })
  )
})

Object.assign
