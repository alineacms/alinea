import styler from '@alinea/styler'
import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
  useLayoutEffect,
  useState
} from 'react'
import {
  type PopoverProps as PopoverPrimitiveProps,
  Popover as PopoverPrimitive
} from 'react-aria-components'
import css from './PopoverSurface.module.css'

const styles = styler(css)

export interface PopoverSurfaceProps extends Omit<
  PopoverPrimitiveProps,
  'children' | 'className'
> {
  className?: string
  ref?: Ref<HTMLElement>
  /**
   * Size the popover to the full width of `triggerRef`. react-aria measures
   * only the button of a Select or the input of a ComboBox, which leaves out
   * the clear button and other adornments of the trigger.
   */
  matchTriggerWidth?: boolean
  children: ReactNode
  [attribute: `data-${string}`]: string | number | boolean | undefined
}

/**
 * The styled react-aria popover. Components that compose react-aria
 * collections (Select, ComboBox, ...) render this directly, the public
 * Popover components are built on top of it.
 */
export function PopoverSurface({
  className,
  matchTriggerWidth,
  style,
  ...props
}: PopoverSurfaceProps) {
  const triggerWidth = useElementWidth(
    matchTriggerWidth ? props.triggerRef : undefined
  )
  const widthStyle =
    triggerWidth === undefined
      ? undefined
      : ({'--alinea-trigger-width': `${triggerWidth}px`} as CSSProperties)
  return (
    <PopoverPrimitive
      {...props}
      style={
        widthStyle && typeof style !== 'function'
          ? {...style, ...widthStyle}
          : style
      }
      className={styles.PopoverSurface(styler.merge({className}))}
    />
  )
}

function useElementWidth(
  ref: RefObject<Element | null> | undefined
): number | undefined {
  const [width, setWidth] = useState<number>()
  useLayoutEffect(() => {
    const element = ref?.current
    if (!element) return
    const update = () => setWidth(element.getBoundingClientRect().width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
