import type {ImageEdit} from '#/core/media/ImageTransform.js'
import {useState, type CSSProperties} from 'react'
import {CroppedImage} from './CroppedImage.js'
import {ImageEditor} from './ImageEditor.js'

/** A landscape test image with a grid and labels, so crops are easy to see */
function testImage(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#2b6cb0')
  gradient.addColorStop(0.5, '#38a169')
  gradient.addColorStop(1, '#d69e2e')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
  context.strokeStyle = 'rgb(255 255 255 / 40%)'
  context.lineWidth = 4
  for (let x = 0; x <= width; x += width / 8) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
  for (let y = 0; y <= height; y += height / 5) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }
  context.fillStyle = 'white'
  context.font = `bold ${height / 6}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('TOP', width / 2, height / 8)
  context.fillText('LEFT', width / 5, height / 2)
  return canvas.toDataURL('image/jpeg', 0.9)
}

const width = 1600
const height = 1000
const src = testImage(width, height)

const previewStyle: CSSProperties = {
  width: 160,
  borderRadius: 6,
  boxShadow: '0 0 0 1px var(--alinea-border)'
}

export function Editor() {
  const [edit, setEdit] = useState<ImageEdit>()
  const [applied, setApplied] = useState(0)
  return (
    <div style={{display: 'grid', gap: 16, padding: 16, maxWidth: 760}}>
      <ImageEditor
        key={applied}
        src={src}
        width={width}
        height={height}
        edit={edit}
        onApply={next => {
          setEdit(next)
          setApplied(count => count + 1)
        }}
        onCancel={() => setApplied(count => count + 1)}
      />
      <div style={{display: 'flex', gap: 16, alignItems: 'center'}}>
        <CroppedImage
          src={src}
          width={width}
          height={height}
          edit={edit}
          style={previewStyle}
        />
        <code style={{fontSize: 12}}>{JSON.stringify(edit ?? {})}</code>
      </div>
    </div>
  )
}

export function Rotated() {
  return (
    <div style={{padding: 16, maxWidth: 760}}>
      <ImageEditor
        src={src}
        width={width}
        height={height}
        edit={{rotate: 90, crop: {x: 0.1, y: 0.2, width: 0.6, height: 0.5}}}
        onApply={() => {}}
        onCancel={() => {}}
      />
    </div>
  )
}

export default {
  title: 'Dashboard / ImageEditor'
}
