import {Button, Select, SelectItem, Text} from '#/components.js'
import {
  rotatedSize,
  type ImageCrop,
  type ImageEdit,
  type ImageRotation
} from '#/core/media/ImageTransform.js'
import styler from '@alinea/styler'
import {useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import {IcRoundRotateLeft, IcRoundRotateRight, IcRoundUndo} from '../icons.js'
import {CroppedImage} from './CroppedImage.js'
import css from './ImageEditor.module.css'
import {
  fitCrop,
  fullCrop,
  isFullCrop,
  moveCrop,
  resizeCrop,
  rotateCrop,
  type CropHandle
} from './ImageEditorCrop.js'

const styles = styler(css)

const aspects = {
  free: {label: 'Free'},
  original: {label: 'Original'},
  '1:1': {label: 'Square', ratio: 1},
  '4:3': {label: 'Landscape 4:3', ratio: 4 / 3},
  '3:2': {label: 'Landscape 3:2', ratio: 3 / 2},
  '16:9': {label: 'Landscape 16:9', ratio: 16 / 9},
  '3:4': {label: 'Portrait 3:4', ratio: 3 / 4},
  '2:3': {label: 'Portrait 2:3', ratio: 2 / 3},
  '9:16': {label: 'Portrait 9:16', ratio: 9 / 16}
} satisfies Record<string, {label: string; ratio?: number}>

type Aspect = keyof typeof aspects

const cornerHandles: Array<CropHandle> = ['nw', 'ne', 'se', 'sw']
const edgeHandles: Array<CropHandle> = ['n', 'e', 's', 'w']

export interface ImageEditorProps {
  src: string
  /** Dimensions of the image as the browser shows it */
  width: number
  height: number
  /** The edit to start from */
  edit?: ImageEdit
  onApply(edit: ImageEdit | undefined): void
  onCancel(): void
}

/** Rotates and crops an image before it is uploaded */
export function ImageEditor({
  src,
  width,
  height,
  edit,
  onApply,
  onCancel
}: ImageEditorProps) {
  const [rotate, setRotate] = useState<ImageRotation>(edit?.rotate ?? 0)
  const [crop, setCrop] = useState<ImageCrop>(edit?.crop ?? fullCrop)
  const [aspect, setAspect] = useState<Aspect>('free')
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    handle?: CropHandle
    crop: ImageCrop
    x: number
    y: number
  }>(undefined)
  const rotated = rotatedSize(width, height, rotate)
  const ratio = aspectRatio(aspect)
  // The ratio of the relative width to the relative height of a crop, the
  // original ratio keeps the crop proportional to the image
  const relativeRatio =
    aspect === 'original'
      ? 1
      : ratio && (ratio * rotated.height) / rotated.width
  const pixels = {
    width: Math.round(crop.width * rotated.width),
    height: Math.round(crop.height * rotated.height)
  }

  const cropStyle = {
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.width * 100}%`,
    height: `${crop.height * 100}%`
  }

  function turn(direction: 1 | -1) {
    setRotate(
      current => ((current + direction * 90 + 360) % 360) as ImageRotation
    )
    setCrop(current => rotateCrop(current, direction))
    // A ratio crop keeps its pixel ratio, flip the preset to match
    setAspect(current => flipAspect(current))
  }

  function selectAspect(next: Aspect) {
    setAspect(next)
    const nextRatio = aspectRatio(next)
    if (next === 'original') setCrop(fullCrop)
    else if (nextRatio)
      setCrop(current =>
        fitCrop(current, (nextRatio * rotated.height) / rotated.width)
      )
  }

  function startDrag(event: PointerEvent<HTMLElement>, handle?: CropHandle) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {handle, crop, x: event.clientX, y: event.clientY}
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const start = drag.current
    const rect = stage.current?.getBoundingClientRect()
    if (!start || !rect) return
    const dx = (event.clientX - start.x) / rect.width
    const dy = (event.clientY - start.y) / rect.height
    setCrop(
      start.handle
        ? resizeCrop(start.crop, start.handle, dx, dy, relativeRatio)
        : moveCrop(start.crop, dx, dy)
    )
  }

  function endDrag() {
    drag.current = undefined
  }

  function onCropKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = event.shiftKey ? 0.1 : 0.01
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    }[event.key]
    if (!delta) return
    event.preventDefault()
    setCrop(current => moveCrop(current, delta[0], delta[1]))
  }

  function reset() {
    setRotate(0)
    setCrop(fullCrop)
    setAspect('free')
  }

  function apply() {
    const result: ImageEdit = {
      ...(rotate ? {rotate} : {}),
      ...(isFullCrop(crop) ? {} : {crop})
    }
    onApply(result.rotate || result.crop ? result : undefined)
  }

  return (
    <div className={styles.ImageEditor()}>
      <div className={styles.ImageEditor.toolbar()}>
        <Button
          variant="outline"
          size="icon-sm"
          icon={IcRoundRotateLeft}
          aria-label="Rotate left"
          onClick={() => turn(-1)}
        />
        <Button
          variant="outline"
          size="icon-sm"
          icon={IcRoundRotateRight}
          aria-label="Rotate right"
          onClick={() => turn(1)}
        />
        <Select
          aria-label="Aspect ratio"
          className={styles.ImageEditor.aspect()}
          value={aspect}
          onValueChange={value => selectAspect((value ?? 'free') as Aspect)}
          required
        >
          {Object.entries(aspects).map(([key, {label}]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </Select>
        <Text
          as="span"
          size="sm"
          color="muted"
          className={styles.ImageEditor.size()}
        >
          {pixels.width} × {pixels.height} px
        </Text>
        <Button variant="ghost" size="sm" icon={IcRoundUndo} onClick={reset}>
          Reset
        </Button>
      </div>
      <div className={styles.ImageEditor.canvas()}>
        <div
          ref={stage}
          className={styles.ImageEditor.stage()}
          style={{
            // Fit the canvas, leaving out its padding
            width: `min(100%, calc((var(--alinea-image-editor-height) - 32px) * ${rotated.width / rotated.height}))`
          }}
        >
          <CroppedImage
            src={src}
            width={width}
            height={height}
            edit={{rotate}}
            className={styles.ImageEditor.image()}
          />
          <div aria-hidden className={styles.ImageEditor.shade()}>
            <span
              className={styles.ImageEditor.shade.hole()}
              style={cropStyle}
            />
          </div>
          <div
            role="group"
            aria-label="Crop area, use the arrow keys to move it"
            tabIndex={0}
            className={styles.ImageEditor.crop()}
            style={cropStyle}
            onKeyDown={onCropKeyDown}
            onPointerDown={event => startDrag(event)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span className={styles.ImageEditor.crop.grid()} />
            {(relativeRatio
              ? cornerHandles
              : [...cornerHandles, ...edgeHandles]
            ).map(handle => (
              <span
                key={handle}
                data-handle={handle}
                className={styles.ImageEditor.crop.handle(handle)}
                onPointerDown={event => startDrag(event, handle)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.ImageEditor.footer()}>
        <Button variant="outline" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button color="primary" onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  )
}

function aspectRatio(aspect: Aspect): number | undefined {
  const preset = aspects[aspect]
  return 'ratio' in preset ? preset.ratio : undefined
}

/** The preset with the width and height swapped */
function flipAspect(aspect: Aspect): Aspect {
  const [width, height] = aspect.split(':')
  if (!height) return aspect
  const flipped = `${height}:${width}`
  return flipped in aspects ? (flipped as Aspect) : 'free'
}
