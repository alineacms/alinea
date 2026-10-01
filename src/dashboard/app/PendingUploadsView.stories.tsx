import {Surface} from '#/components.js'
import type {
  MediaMatch,
  PendingUpload,
  PendingUploads
} from '#/dashboard/atoms/upload.js'
import {useState, type CSSProperties} from 'react'
import {PendingUploadsView} from './PendingUploadsView.js'

/** A jpeg of a colored gradient, as a file picked for upload */
function photo(name: string, width: number, height: number, hue: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, `hsl(${hue} 70% 45%)`)
  gradient.addColorStop(1, `hsl(${hue + 60} 70% 60%)`)
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
  const [, data] = canvas.toDataURL('image/jpeg', 0.9).split(',')
  const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0))
  const file = new File([bytes], name, {type: 'image/jpeg'})
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    imageSize: {width, height}
  }
}

function pdf(name: string, size: number) {
  return {file: new File([new Uint8Array(size)], name), compress: true}
}

function match(title: string): MediaMatch {
  return {
    id: title,
    title,
    workspace: 'main',
    root: 'media',
    parentId: null,
    url: `/media/${title}`,
    extension: '.jpg'
  }
}

function upload(
  id: string,
  file: Pick<PendingUpload, 'file' | 'previewUrl' | 'imageSize' | 'compress'>,
  extra: Partial<PendingUpload> = {}
): PendingUpload {
  return {
    id,
    ...file,
    action: 'upload',
    ...extra
  }
}

const destination = {workspace: 'main', root: 'media'}

const newFiles: PendingUploads = {
  destination,
  uploads: [
    upload('harbour', photo('harbour-at-dawn.jpg', 1600, 1000, 200)),
    upload('portrait', photo('team-portrait.jpg', 900, 1200, 20)),
    upload('brochure', pdf('brochure-2026.pdf', 2_400_000))
  ]
}

const existingFiles: PendingUploads = {
  destination,
  uploads: [
    upload('duplicate', photo('logo.jpg', 800, 800, 280), {
      duplicate: match('Company logo'),
      action: 'existing'
    }),
    upload('conflict', photo('hero.jpg', 1920, 1080, 120), {
      conflict: match('hero')
    }),
    upload('both', pdf('price-list.pdf', 180_000), {
      duplicate: match('Price list 2025'),
      conflict: match('price-list'),
      action: 'existing'
    })
  ]
}

const replaceFile: PendingUploads = {
  destination,
  replace: match('Harbour at dawn'),
  uploads: [
    upload('replacement', photo('harbour-new.jpg', 1600, 900, 180), {
      action: 'replace'
    })
  ]
}

const frameStyle: CSSProperties = {width: 640, margin: 16}

function Story({initial}: {initial: PendingUploads}) {
  const [pending, setPending] = useState(initial)
  const [result, setResult] = useState<string>()
  return (
    <div>
      <Surface style={frameStyle}>
        <PendingUploadsView
          pending={pending}
          onChange={(id, change) =>
            setPending(current => ({
              ...current,
              uploads: current.uploads.map(upload =>
                upload.id === id ? {...upload, ...change} : upload
              )
            }))
          }
          onRemove={id =>
            setPending(current => ({
              ...current,
              uploads: current.uploads.filter(upload => upload.id !== id)
            }))
          }
          onCancel={() => setResult('Cancelled')}
          onConfirm={() =>
            setResult(
              JSON.stringify(
                pending.uploads.map(({file, action, edit}) => ({
                  file: file.name,
                  action,
                  edit
                })),
                null,
                2
              )
            )
          }
        />
      </Surface>
      {result && <pre style={{margin: 16, fontSize: 12}}>{result}</pre>}
    </div>
  )
}

export function NewFiles() {
  return <Story initial={newFiles} />
}

export function ExistingFiles() {
  return <Story initial={existingFiles} />
}

export function Replace() {
  return <Story initial={replaceFile} />
}

export default {
  title: 'Dashboard / PendingUploads'
}
