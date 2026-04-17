import type {SVGProps} from 'react'

export function TableSplitCell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M19 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h14ZM8 15.5H5V18h3v-2.5Zm11-5h-9V18h9v-7.5Zm-2.5 1 1 1-2 2 2 2-1 1-2-2-2 2-1-1 2-2-2-2 1-1 2 2 2-2Zm-8.5-1H5v3h3v-3ZM19 6h-4v2.5h4V6ZM8 6H5v2.5h3V6Zm5 0h-3v2.5h3V6Z"
      />
    </svg>
  )
}
