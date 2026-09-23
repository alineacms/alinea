import {useState} from 'react'
import {Link} from './Link.js'

export function Example() {
  const [clicks, setClicks] = useState(0)
  return (
    <div
      style={{display: 'flex', flexDirection: 'column', gap: 16, padding: 24}}
    >
      <Link href="https://alinea.sh" target="_blank">
        Plain link
      </Link>
      <Link href="https://alinea.sh" variant="underline">
        Underlined link
      </Link>
      <Link
        href="#clicked"
        onClick={event => {
          event.preventDefault()
          setClicks(clicks + 1)
        }}
      >
        Clicked {clicks} times
      </Link>
      <Link href="https://alinea.sh" disabled>
        Disabled link
      </Link>
    </div>
  )
}

export default {
  title: 'Pure components / Link'
}
