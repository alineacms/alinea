import {Field} from 'alinea/core/Field'
import {
  Section,
  SectionData,
  SectionDefinition,
  section
} from 'alinea/core/Section'
import {View} from 'alinea/core/View'
import {ReactNode} from 'react'

export class ViewSection implements SectionData {
  view: View<{section: Section}>
  definition: SectionDefinition = {}
  fields: Record<string, Field> = {}
  sections = []
  constructor(view: View<{section: Section}>) {
    this.view = view
  }
}

export function view(view: string | ReactNode) {
  return section(new ViewSection(typeof view === 'string' ? view : () => view))
}
