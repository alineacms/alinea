import {ReadonlyURLSearchParams} from 'next/navigation'
import {SVGProps} from 'react'

export const supportedFrameworks = [
  {
    name: 'next',
    label: 'Next.js',
    icon: TablerBrandNextjs,
    link(url: string) {
      return url
    }
  },
  {
    name: 'js',
    icon: TablerBrandJavascript,
    label: 'Vanilla js',
    link(url: string) {
      return url.replace('/docs/', '/docs:js/')
    }
  }
]

function selectedFramework(
  searchParams: string | undefined | ReadonlyURLSearchParams
) {
  if (searchParams)
    for (const framework of supportedFrameworks) {
      if (typeof searchParams !== 'string') {
        if (searchParams.has(framework.name)) return framework
      } else {
        if (framework.name === searchParams) return framework
      }
    }
  return supportedFrameworks[0]
}

export function getFramework(
  searchParams: string | undefined | ReadonlyURLSearchParams
) {
  return selectedFramework(searchParams)
}

function TablerBrandJavascript(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      >
        <path d="m20 4l-2 14.5l-6 2l-6-2L4 4z"></path>
        <path d="M7.5 8h3v8l-2-1m8-7H14a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h1.423a.5.5 0 0 1 .495.57L15.5 15.5l-2 .5"></path>
      </g>
    </svg>
  )
}

function TablerBrandNextjs(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 15V9l7.745 10.65A9 9 0 1 1 19 17.657M15 12V9"
      ></path>
    </svg>
  )
}
