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
import {useForceUpdate} from '../hook/UseForceUpdate'

export function createSlots() {
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
    const [_, setRefs] = useContext(context)!
    const redraw = useForceUpdate()
    useLayoutEffect(() => {
      setRefs(refs => refs.concat(ref))
      setTimeout(redraw)
      return () => setRefs(refs => refs.filter(r => r !== ref))
    }, [])
    return ref
  }

  function Slot({children}: PropsWithChildren<{}>) {
    const ref = useSlot()
    if (!ref.current) return null
    return createPortal(children, ref.current)
  }

  function Portal() {
    const [refs] = useContext(context)!
    return (
      <>
        {refs.map((ref, i) => {
          return <div ref={ref} key={i} />
        })}
      </>
    )
  }

  return {Provider, Portal, Slot}
}
