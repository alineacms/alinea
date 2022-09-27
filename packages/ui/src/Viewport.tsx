import {HTMLProps, PropsWithChildren, useEffect, useLayoutEffect} from 'react'
import {useContrastColor} from './hook/UseContrastColor'
import {PreferencesProvider, usePreferences} from './hook/UsePreferences'
import {fromModule} from './util/Styler'
import css from './Viewport.module.scss'

const styles = fromModule(css)

type ViewportProps = PropsWithChildren<
  {
    color?: string
    contain?: boolean
    // Some UI frameworks insist on helping you by rendering components to the
    // body element directly. To style these we can apply our global styles
    // to the body instead. Don't use this if you're server side rendering.
    attachToBody?: boolean
  } & HTMLProps<HTMLDivElement>
>

const useIsomorphicEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

function ViewportView({
  children,
  color = '#6673FC',
  contain,
  attachToBody,
  ...props
}: ViewportProps) {
  const accentColor = color!
  const accentColorForeground = useContrastColor(accentColor)
  const {scheme, size} = usePreferences()
  useEffect(() => {
    if (!size) return
    document.documentElement.style.fontSize = `${size}px`
  }, [size])
  const style: any = {
    '--alinea-accent': accentColor,
    '--alinea-accent-foreground': accentColorForeground
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
  }, [attachToBody, styleString, className])
  useIsomorphicEffect(() => {
    const meta = document.createElement('meta')
    meta.setAttribute('content', accentColor)
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [accentColor])
  const mainProps = attachToBody ? {} : {className, style}
  return (
    <main
      {...mainProps}
      className={styles.main.mergeProps(mainProps)({contain})}
    >
      {children}
      {/* See: https://github.com/tailwindlabs/headlessui/discussions/666#discussioncomment-2197931 */}
      <div id="headlessui-portal-root">
        <div />
      </div>
    </main>
  )
}

export function Viewport(props: ViewportProps) {
  const preferences = usePreferences()
  if (preferences) return <ViewportView {...props} />
  return (
    <PreferencesProvider>
      <ViewportView {...props} />
    </PreferencesProvider>
  )
}
