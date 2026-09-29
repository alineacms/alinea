import {useState} from 'react'
import {type FocusPoint, MediaPreview} from './MediaPreview.js'
import {Text} from './Text.js'

const image = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#4c57f6"/><stop offset="1" stop-color="#f1d3b7"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="420" cy="160" r="60" fill="#fff8e1"/></svg>'
)}`

const placeholder = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#8890f9"/><rect x="2" width="2" height="3" fill="#f1d3b7"/></svg>'
)}`

const previewStyle = {width: 480, height: 360, margin: 24}

function format(point: FocusPoint | null) {
  return point ? `${point.x.toFixed(2)}, ${point.y.toFixed(2)}` : 'none'
}

export function Example() {
  const [focus, setFocus] = useState<FocusPoint>({x: 0.5, y: 0.5})
  const [hover, setHover] = useState<FocusPoint | null>(null)
  return (
    <div>
      <MediaPreview
        style={previewStyle}
        src={image}
        placeholder={placeholder}
        width={640}
        height={400}
        alt="A gradient with a sun"
        focus={focus}
        onFocusChange={setFocus}
        onFocusHover={setHover}
      />
      <Text style={{marginInline: 24}}>Focus: {format(focus)}</Text>
      <Text style={{marginInline: 24}}>Hover: {format(hover)}</Text>
    </div>
  )
}

export function ReadOnly() {
  return (
    <MediaPreview
      style={previewStyle}
      src={image}
      placeholder={placeholder}
      averageColor="#b1b5fb"
      width={640}
      height={400}
      alt="A gradient with a sun"
      focus={{x: 0.66, y: 0.4}}
    />
  )
}

export default {
  title: 'Pure components / MediaPreview'
}
