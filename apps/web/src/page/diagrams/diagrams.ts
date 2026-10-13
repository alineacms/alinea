export interface DiagramInfo {
  label: string
  /** Read out in place of the drawing, and written to the markdown docs */
  description: string
}

export const diagrams = {
  publishing: {
    label: 'How publishing works',
    description:
      "Publish flow: the dashboard publishes to your site's handler, which commits to git and revalidates your running site. The CI build is skipped for commits that only touch content."
  }
} satisfies Record<string, DiagramInfo>

export type DiagramId = keyof typeof diagrams

export function isDiagramId(id: string): id is DiagramId {
  return Object.hasOwn(diagrams, id)
}
