import {useEffect, useLayoutEffect, useRef} from 'react'

/** Whether the keyboard event is ⌘K (macOS) or Ctrl+K (elsewhere) */
export function isSearchShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'k' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

/** Apple platforms use ⌘ where others use Ctrl */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform =
    (navigator as Navigator & {userAgentData?: {platform?: string}})
      .userAgentData?.platform ??
    navigator.platform ??
    ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** The search shortcut as shown to the user, eg. `⌘K` */
export function searchShortcutLabel(apple = isApplePlatform()): string {
  return apple ? '⌘K' : 'Ctrl K'
}

/**
 * Runs `action` on ⌘K / Ctrl+K anywhere in the document, including text
 * inputs. The event is handled while capturing because overlays stop the
 * propagation of key events. Rich text editors bind the shortcut themselves
 * (to add a link), so events from editable content are left alone.
 */
export function useSearchShortcut(action: () => void, disabled = false) {
  const state = useRef({action, disabled})
  useLayoutEffect(() => {
    state.current = {action, disabled}
  }, [action, disabled])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || !isSearchShortcut(event)) return
      const target = event.target
      if (target instanceof HTMLElement && target.isContentEditable) return
      const current = state.current
      if (current.disabled) return
      event.preventDefault()
      current.action()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
