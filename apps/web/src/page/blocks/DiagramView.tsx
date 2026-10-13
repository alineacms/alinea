import type {Infer} from 'alinea'
import type {ComponentType} from 'react'
import {type DiagramId, isDiagramId} from '@/page/diagrams/diagrams'
import {PublishingDiagram} from '@/page/diagrams/PublishingDiagram'
import type {DiagramBlock} from '@/schema/blocks/DiagramBlock'

const views: Record<DiagramId, ComponentType> = {
  publishing: PublishingDiagram
}

export function DiagramView({diagram}: Infer<typeof DiagramBlock>) {
  if (!diagram || !isDiagramId(diagram)) return null
  const View = views[diagram]
  return <View />
}
