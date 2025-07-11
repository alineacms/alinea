import type {Metadata} from 'next'
import {getMetadata} from '@/utils/metadata'

export {default} from '@/page/NotFound'

export async function generateMetadata(): Promise<Metadata> {
  return await getMetadata(null)
}
