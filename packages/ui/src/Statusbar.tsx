import {
  createContext,
  Dispatch,
  PropsWithChildren,
  Ref,
  SetStateAction,
  useContext,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import {createPortal} from 'react-dom'
import type {IconType} from 'react-icons'
import {useForceUpdate} from './hook/UseForceUpdate'
import {Icon} from './Icon'
import {HStack} from './Stack'
import css from './Statusbar.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Statusbar {
  const context = createContext<
    | [
        Array<Ref<HTMLDivElement>>,
        Dispatch<SetStateAction<Array<Ref<HTMLDivElement>>>>
      ]
    | undefined
  >(undefined)

  export function Provider({children}: PropsWithChildren<{}>) {
    const [refs, setRefs] = useState<Array<Ref<HTMLDivElement>>>([])
    return (
      <context.Provider value={[refs, setRefs]}>{children}</context.Provider>
    )
  }

  export function useSlot() {
    const ref = useRef<HTMLDivElement>(null)
    const [_, setRefs] = useContext(context)!
    const redraw = useForceUpdate()
    useLayoutEffect(() => {
      setRefs(refs => refs.concat(ref))
      setTimeout(redraw)
      return () => setRefs(refs => refs.filter(r => r !== ref))
    }, [])
    return ref
  }

  export function Slot({children}: PropsWithChildren<{}>) {
    const ref = useSlot()
    if (!ref.current) return null
    return createPortal(children, ref.current)
  }

  /*export function Provided() {
    const [nodes] = useContext(context)!
    return (
      <>
        {nodes.map((node, i) => (
          <Fragment key={i}>{node}</Fragment>
        ))}
      </>
    )
  }

  export function useStatusbar(node: ReactNode) {
    const [nodes, setNodes] = useContext(context)!

    useLayoutEffect(() => {
      setNodes(nodes.concat(node))
      return () => setNodes(nodes.filter(n => n !== node))
    }, [])
  }*/

  export function Root({children}: PropsWithChildren<{}>) {
    const [refs, setRefs] = useContext(context)!
    return (
      <footer className={styles.root()}>
        {refs.map((ref, i) => {
          return <div ref={ref} key={i} />
        })}
        {children}
      </footer>
    )
  }

  export type StatusProps = PropsWithChildren<{
    icon: IconType
  }>

  export function Status({children, icon}: StatusProps) {
    return (
      <div className={styles.status()}>
        <HStack center gap={5}>
          <Icon icon={icon} />
          <span>{children}</span>
        </HStack>
      </div>
    )
  }
}
