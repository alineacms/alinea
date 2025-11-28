import type {SVGProps} from 'react'

export function TableHeaderCell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M19 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h14Zm-8 9H5v5h6v-5Zm8 0h-6v5h6v-5Zm-8-7H5v5h6V6Z"
      ></path>
    </svg>
  )
}
