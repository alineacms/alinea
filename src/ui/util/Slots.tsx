import {
  ComponentType,
  createContext,
  Dispatch,
  HTMLProps,
  PropsWithChildren,
  Ref,
  SetStateAction,
  useContext,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import {createPortal} from 'react-dom'
import {useForceUpdate} from '../hook/UseForceUpdate.js'

type Slots = {
  Provider: ComponentType<PropsWithChildren<{}>>
  Portal: ComponentType<HTMLProps<HTMLDivElement>>
  Slot: ComponentType<PropsWithChildren<{}>>
}

export function createSlots(): Slots {
  const context = createContext<
    | [
        Array<Ref<HTMLDivElement>>,
        Dispatch<SetStateAction<Array<Ref<HTMLDivElement>>>>
      ]
    | undefined
  >(undefined)

  function Provider({children}: PropsWithChildren<{}>) {
    const [refs, setRefs] = useState<Array<Ref<HTMLDivElement>>>([])
    return (
      <context.Provider value={[refs, setRefs]}>{children}</context.Provider>
    )
  }

  function useSlot() {
    const ref = useRef<HTMLDivElement>(null)
    const [refs, setRefs] = useContext(context)!
    const redraw = useForceUpdate()
    useLayoutEffect(() => {
      setRefs(refs => refs.concat(ref))
      return () => setRefs(refs => refs.filter(r => r !== ref))
    }, [])
    useLayoutEffect(redraw, [refs])
    return ref
  }

  function Slot({children}: PropsWithChildren<{}>) {
    const ref = useSlot()
    if (!ref.current) return null
    return createPortal(children, ref.current)
  }

  function Portal(props: HTMLProps<HTMLDivElement>) {
    const [refs] = useContext(context)!
    return (
      <>
        {refs.map((ref, i) => {
          return <div ref={ref} key={i} {...props} />
        })}
      </>
    )
  }

  return {Provider, Portal, Slot}
}
