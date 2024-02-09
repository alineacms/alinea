import {Recipe} from '@/demo/Recipe'
import {Entry} from 'alinea/core/Entry'

interface PagePreviewProps {
  entry: Entry
}

export function PagePreview({entry}) {
  switch (entry.type) {
    case 'Recipe':
      return <Recipe {...entry.data} />
  }
  return null
}
