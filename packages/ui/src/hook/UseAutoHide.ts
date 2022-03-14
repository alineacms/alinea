import {RefObject, useEffect, useRef} from 'react'

export type AutoHideOptions = {
  scrollRef?: RefObject<HTMLElement>
  addToHeight?: number
}

export const useAutoHide = <E extends HTMLElement = HTMLElement>(
  options?: AutoHideOptions
) => {
  const ref = useRef<E>(null)
  const height = useRef<number>(0)
  const lastScroll = useRef(0)
  const offset = useRef(0)

  useEffect(() => {
    const dom = ref.current!
    const {style} = dom

    const scroll = () => {
      const y = options?.scrollRef?.current
        ? options?.scrollRef?.current.scrollTop
        : window.pageYOffset
      const diff = lastScroll.current - y
      const last = offset.current
      offset.current += diff
      if (offset.current < -height.current) offset.current = -height.current
      if (y <= 0 || offset.current > 0) offset.current = 0
      if (last !== offset.current)
        style.transform = `translateY(${offset.current}px)`
      lastScroll.current = y
      if (y <= height.current) dom.classList.add('is-top')
      else dom.classList.remove('is-top')
    }

    const trackHeight = () => {
      height.current = dom.offsetHeight + (options?.addToHeight || 0)
    }

    trackHeight()
    scroll()

    const target = options?.scrollRef?.current || window

    target.addEventListener('scroll', scroll)
    window.addEventListener('resize', trackHeight)

    return () => {
      target.removeEventListener('scroll', scroll)
      window.removeEventListener('resize', trackHeight)
    }
  }, [options?.scrollRef, options?.addToHeight])

  return {ref}
}
