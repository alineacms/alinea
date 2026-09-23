import {Spinner} from './Spinner.js'

export function Example() {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: 24}}>
      <Spinner size="sm" />
      <Spinner aria-label="Loading entries" />
      <Spinner size="lg" />
    </div>
  )
}

export function Determinate() {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: 24}}>
      <Spinner value={25} aria-label="Uploading" />
      <Spinner value={75} size="lg" aria-label="Processing" />
    </div>
  )
}

export default {
  title: 'Pure components / Spinner'
}
