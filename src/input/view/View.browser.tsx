import {Section} from 'alinea/core'
import {InputState} from 'alinea/editor'
import {ViewSection, view as createView} from './View.js'

export * from './View.js'

export const view = Section.provideView(View, createView)

interface ViewProps {
  state: InputState<any>
  section: Section
}

function View({state, section}: ViewProps) {
  const {children} = section[Section.Data] as ViewSection
  return children
}
