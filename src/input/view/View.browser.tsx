import {Section} from 'alinea/core'
import {ViewSection, view as createView} from './View.js'

export * from './View.js'

export const view = Section.provideView(View, createView)

interface ViewProps {
  section: Section
}

function View({section}: ViewProps) {
  const {children} = section[Section.Data] as ViewSection
  return children
}
