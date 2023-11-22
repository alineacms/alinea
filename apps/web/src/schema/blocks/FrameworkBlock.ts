import {supportedFrameworks} from '@/nav/Frameworks'
import alinea from 'alinea'
import {TextField} from './TextBlock'

export const FrameworkBlock = alinea.type('Framework specific', {
  ...alinea.tabs(
    ...supportedFrameworks.map(framework => {
      return alinea.tab(framework.label, {
        [framework.name]: TextField
      })
    })
  )
})

Object.assign
