import {ColorSwatch} from './ColorSwatch.js'

export function Example() {
  return (
    <div style={{display: 'flex', gap: 8, padding: 24}}>
      <ColorSwatch color="#f80" />
      <ColorSwatch color="#08f" />
      <ColorSwatch color="#f00a" colorName="Translucent red" />
    </div>
  )
}

export default {
  title: 'Pure components / ColorSwatch'
}
