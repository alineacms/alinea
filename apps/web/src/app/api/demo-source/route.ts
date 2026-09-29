import {FSSource} from 'alinea/core/source/FSSource'
import {exportSource} from 'alinea/core/source/SourceExport'

export const dynamic = 'force-static'

/**
 * The Oak & Loom demo content, fetched by the field previews on /docs/fields
 * that link to entries and images
 */
export async function GET() {
  return Response.json(await exportSource(new FSSource('content/demo')))
}
