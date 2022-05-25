import {render} from 'react-dom'

export function reactRender(subject, into) {
  render(subject, into)
  return () => render(null, into)
}
