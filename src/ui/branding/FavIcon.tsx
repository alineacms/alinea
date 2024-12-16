import {btoa} from 'alinea/core/util/Encoding'
import {memo} from 'react'
import {useContrastColor} from '../hook/UseContrastColor.js'

type FavIconProps = {
  color: string
}
export const FavIcon = memo(function FavIcon({color}: FavIconProps) {
  const accentColorForeground = useContrastColor(color)

  const favicon = btoa(
    `
    <svg
      width="36"
      height="36"
      view-box="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="grad1"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
          gradient-transform="rotate(65)"
        >
          <stop offset="0%" style="stop-color: ${color}; stop-opacity: 1" />
          <stop
            offset="100%"
            style="stop-color: ${color}; stop-opacity: 1"
          />
        </linearGradient>
      </defs>
      <path
        d="M18 36C25.884 36 29.9427 36 32.8047 33.138C35.6667 30.276 36 25.884 36 18C36 10.116 35.6667 6.05733 32.8047 3.19533C29.9427 0.333333 25.884 0 18 0C10.116 0 6.05733 0.333333 3.19533 3.19533C0.333333 6.05733 0 10.116 0 18C0 25.884 0.333333 29.9427 3.19533 32.8047C6.05733 35.6667 10.116 36 18 36Z"
        fill="url(#grad1)"
      />
      <path 
        fill="${accentColorForeground}" 
        d="M20.8178 10.3977V11.733C19.8978 10.6534 18.5316 10 16.6636 10C13.0112 10 10 13.267 10 17.5C10 21.733 13.0112 25 16.6636 25C18.5316 25 19.8978 24.3466 20.8178 23.267V24.6023H25V10.3977H20.8178ZM17.5 20.9659C15.5762 20.9659 14.1822 19.6307 14.1822 17.5C14.1822 15.3693 15.5762 14.0341 17.5 14.0341C19.4238 14.0341 20.8178 15.3693 20.8178 17.5C20.8178 19.6307 19.4238 20.9659 17.5 20.9659Z"
      />
      </svg>
  `
  )

  return (
    <link
      rel="icon"
      type="image/svg"
      href={`data:image/svg+xml;base64,${favicon}`}
    />
  )
})
