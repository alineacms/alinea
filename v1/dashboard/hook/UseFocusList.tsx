import {
  createContext,
  type KeyboardEvent,
  type PropsWithChildren,
  type Ref,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef
} from 'react'

type FocusListContext = {
  registerItem: (onSelect: () => void, element: HTMLElement) => () => void
}

const context = createContext<FocusListContext | undefined>(undefined)

type FocusListParams = {
  onClear: () => void
}

// This is a non-accesible prototype, see
// https://github.com/alineacms/alinea/issues/27
export function useFocusList({onClear}: FocusListParams) {
  const focusRef = useRef<HTMLElement>()
  const {reSelect, ...res} = useMemo(() => {
    const selects = new WeakMap<HTMLElement, () => void>()
    let current: HTMLElement | undefined
    let items: Array<HTMLElement> = []
    let itemsReset = true
    let selectTimeout: number | undefined
    function select(element: HTMLElement | undefined) {
      if (current) current.removeAttribute('aria-selected')
      if (!element) return (current = undefined)
      element.setAttribute('aria-selected', 'true')
      current = element
      current.scrollIntoView({block: 'nearest'})
    }
    function navigate(direction: 1 | -1) {
      if (current) {
        const index = items.indexOf(current)
        const next = items[index + direction]
        if (next) return select(next)
      }
      select(items[direction === 1 ? 0 : items.length - 1])
    }
    function onKeyDown(event: KeyboardEvent<HTMLElement>) {
      switch (event.key) {
        case 'ArrowUp':
          navigate(-1)
          event.preventDefault()
          break
        case 'ArrowDown':
          navigate(1)
          event.preventDefault()
          break
        case 'Escape':
          event.currentTarget.blur()
          event.preventDefault()
          onClear()
          break
        case 'Enter':
          event.preventDefault()
          selects.get(current ?? items[0])?.()
          break
        default:
      }
    }
    const focusProps = {
      ref: focusRef as Ref<any>,
      onKeyDown,
      /*onFocus() {
        selectFirst()
      },*/
      onBlur() {
        select(undefined)
        itemsReset = true
      }
    }
    function registerItem(onSelect: () => void, element: HTMLElement) {
      let i = 0
      for (const item of items) {
        const position = element.compareDocumentPosition(item)
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) break
        i++
      }
      items.splice(i, 0, element)
      selects.set(element, onSelect)
      //window.clearTimeout(selectTimeout)
      //selectTimeout = window.setTimeout(selectFirst, 0)
      return () => {
        if (current === element) current = undefined
        items = items.filter(item => item !== element)
      }
    }
    function Container({children}: PropsWithChildren<{}>) {
      return (
        <context.Provider value={{registerItem}}>{children}</context.Provider>
      )
    }
    function selectFirst() {
      if (
        document.activeElement !== focusRef.current &&
        !focusRef.current?.contains(document.activeElement as Node)
      )
        return
      if (!itemsReset) return
      if (!current) select(items[0])
      itemsReset = false
    }
    function reSelect() {
      itemsReset = true
    }
    return {focusProps, Container, reSelect}
  }, [])
  useLayoutEffect(reSelect)
  return res
}

export function useFocusListItem<Element extends HTMLElement = HTMLElement>(
  onSelect: () => void
): Ref<Element> {
  const ctx = useContext(context)!
  const itemRef = useRef<Element>(null)
  useLayoutEffect(() => {
    if (itemRef.current && ctx)
      return ctx.registerItem(onSelect, itemRef.current)
  }, [])
  return itemRef
}
