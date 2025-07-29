import type {SVGProps} from 'react'

export function SidebarRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M0,1.71v20.58c0,.95.77,1.71,1.71,1.71h20.58c.95,0,1.71-.77,1.71-1.71V1.71c0-.95-.77-1.71-1.71-1.71H1.71C.77,0,0,.77,0,1.71ZM1.71,22.3V1.71h12.01v20.58H1.71v.02Z"
      />
    </svg>
  )
}
