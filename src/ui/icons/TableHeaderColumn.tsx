import type {SVGProps} from 'react'

export function TableHeaderColumn(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M19,4 C20.1045695,4 21,4.8954305 21,6 L21,18 C21,19.1045695 20.1045695,20 19,20 L5,20 C3.8954305,20 3,19.1045695 3,18 L3,6 C3,4.8954305 3.8954305,4 5,4 L19,4 Z M19,13 L15,13 L15,18 L19,18 L19,13 Z M13,13 L9,13 L9,18 L13,18 L13,13 Z M13,6 L9,6 L9,11 L13,11 L13,6 Z M19,6 L15,6 L15,11 L19,11 L19,6 Z"
      />
    </svg>
  )
}
