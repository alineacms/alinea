import type {SVGProps} from 'react'

function StrokeIcon({children, ...props}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function DocsIconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <StrokeIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </StrokeIcon>
  )
}

export function DocsIconCopy(props: SVGProps<SVGSVGElement>) {
  return (
    <StrokeIcon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </StrokeIcon>
  )
}

export function DocsIconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <StrokeIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </StrokeIcon>
  )
}

export function DocsIconInfo(props: SVGProps<SVGSVGElement>) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </StrokeIcon>
  )
}

export function DocsIconWarning(props: SVGProps<SVGSVGElement>) {
  return (
    <StrokeIcon {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </StrokeIcon>
  )
}

export function DocsIconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <StrokeIcon {...props}>
      <path d="m9 6 6 6-6 6" />
    </StrokeIcon>
  )
}

export function DocsIconArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <StrokeIcon {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </StrokeIcon>
  )
}
