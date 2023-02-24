import {btoa} from 'alinea/core/util/Encoding'
import {useContrastColor} from '../hook/UseContrastColor.js'

type FavIconProps = {
  color: string
}
export function FavIcon({color}: FavIconProps) {
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
      ></path>
      ` + //<path fill="${accentColorForeground}" d="M19,16h7l-9,13v-9h-7l9-13V16z"/>
      `</svg>
  `
  )

  return (
    <link
      rel="icon"
      type="image/svg"
      href={`data:image/svg+xml;base64,${favicon}`}
    />
  )
}
