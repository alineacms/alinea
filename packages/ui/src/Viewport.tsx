import {parseToHsla} from 'color2k'
import {PropsWithChildren, useEffect, useLayoutEffect} from 'react'
import {useContrastColor} from './hook/UseContrastColor'
import {usePreferences} from './hook/UsePreferences'
import {fromModule} from './util/Styler'
import css from './Viewport.module.scss'

const styles = fromModule(css)

type ViewportProps = PropsWithChildren<{
  color: string
  contain?: boolean
  // Some UI frameworks insist on helping you by rendering components to the
  // body element directly. To style these we can apply our global styles
  // to the body instead. Don't use this if you're server side rendering.
  attachToBody?: boolean
}>

const useIsomorphicEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function Viewport({
  children,
  color,
  contain,
  attachToBody
}: ViewportProps) {
  const accentColor = color!
  const accentColorForeground = useContrastColor(accentColor)
  // ERROR: Cannot destructure property 'scheme' of 'preferences' as it is undefined (when localStorage is empty)
  const {scheme, size} = usePreferences()
  useEffect(() => {
    if (!size) return
    document.documentElement.style.fontSize = `${size}px`
  }, [size])
  const [hue] = parseToHsla(accentColor)
  const style: any = {
    '--alinea-accent': accentColor,
    '--alinea-accent-foreground': accentColorForeground
    // '--alinea-hue': hue
  }
  const className = styles.root(scheme)
  const styleString = Object.entries(style)
    .map(([key, value]) => {
      return `${key}: ${value}`
    })
    .join('; ')
  useIsomorphicEffect(() => {
    if (attachToBody) {
      document.body.className = className
      document.body.style.cssText = styleString
    }
  }, [styleString, className])
  const mainProps = attachToBody ? {} : {className, style}
  return (
    <main
      {...mainProps}
      className={styles.main.mergeProps(mainProps)({contain})}
    >
      {children}
    </main>
  )
}
