import type {Field} from 'alinea/core/Field'
import {
  type Section,
  type SectionData,
  type SectionDefinition,
  section
} from 'alinea/core/Section'
import type {View} from 'alinea/core/View'
import type {ReactNode} from 'react'

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
