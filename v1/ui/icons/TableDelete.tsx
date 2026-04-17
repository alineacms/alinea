import type {SVGProps} from 'react'

export function TableDelete(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M19 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h14ZM5 6v12h14V6H5Z"
      />
      <path
        fill="currentColor"
        d="m14.4 8.6 1.1 1-2.4 2.4 2.4 2.4-1.1 1.1-2.4-2.4-2.4 2.4-1-1.1 2.3-2.4-2.3-2.4 1-1 2.4 2.3z"
      />
    </svg>
  )
}
