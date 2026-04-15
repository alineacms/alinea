import type {Field} from '#/core/Field.js'
import {
  type Section,
  type SectionData,
  type SectionDefinition,
  section
} from '#/core/Section.js'
import type {View} from '#/core/View.js'
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
