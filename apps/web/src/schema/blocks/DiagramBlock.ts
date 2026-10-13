import {Config, Field} from 'alinea'
import {diagrams} from '@/page/diagrams/diagrams'

export const DiagramBlock = Config.type('Diagram', {
  fields: {
    diagram: Field.select('Diagram', {
      required: true,
      help: 'Diagrams are drawn in code, they live in src/page/diagrams',
      options: Object.fromEntries(
        Object.entries(diagrams).map(([id, {label}]) => [id, label])
      )
    })
  }
})
