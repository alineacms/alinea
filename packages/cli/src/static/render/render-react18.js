import {createRoot} from 'react-dom/client'

export function reactRender(subject, into) {
  const root = createRoot(into)
  root.render(subject)
  return () => root.unmount()
}
