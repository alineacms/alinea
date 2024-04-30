import {SVGProps} from 'react'

export function TableHeaderRow(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M19 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h14ZM5 15v3h6v-3H5Zm14 0h-6v3h6v-3Zm0-9h-6v3h6V6ZM5 9h6V6H5v3Z"
      ></path>
    </svg>
  )
}
