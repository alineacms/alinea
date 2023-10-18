import {autoUpdate, flip, offset, useFloating} from '@floating-ui/react-dom'
import {Menu} from '@headlessui/react'
import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  createContext,
  useContext
} from 'react'
import css from './DropdownMenu.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export namespace DropdownMenu {
  const floatingContext = createContext<ReturnType<typeof useFloating>>(
    undefined!
  )

  export function Root(
    props: HTMLAttributes<HTMLDivElement> & {
      top?: boolean
      bottom?: boolean
      left?: boolean
      right?: boolean
    }
  ) {
    const side = props.top ? 'top' : 'bottom'
    const align = props.left ? 'end' : 'start'
    const floating = useFloating({
      whileElementsMounted: autoUpdate,
      strategy: 'fixed',
      placement: `${side}-${align}` as const,
      middleware: [offset(4), flip()]
    })
    return (
      <floatingContext.Provider value={floating}>
        <Menu>
          <div {...props} className={styles.root.mergeProps(props)()} />
        </Menu>
      </floatingContext.Provider>
    )
  }

  export function Trigger(props: HTMLAttributes<HTMLButtonElement>) {
    const floating = useContext(floatingContext)
    return (
      <Menu.Button
        ref={floating.reference}
        {...props}
        className={styles.trigger.mergeProps(props)()}
      />
    )
  }

  export function Items(props: HTMLAttributes<HTMLDivElement>) {
    const floating = useContext(floatingContext)
    return (
      <Menu.Items
        {...props}
        ref={floating.floating}
        style={{
          position: floating.strategy,
          top: `${floating.y || 0}px`,
          left: `${floating.x || 0}px`
        }}
        className={styles.items.mergeProps(props)()}
      />
    )
  }

  export function Item(props: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
      <Menu.Item>
        {({active}: {active: boolean}) => {
          return (
            <button
              {...props}
              className={styles.item.mergeProps(props)({active})}
            />
          )
        }}
      </Menu.Item>
    )
  }
}
