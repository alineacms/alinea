import {useEffect, useLayoutEffect, useRef} from 'react'

interface SaveShortcutState {
  action: (() => void) | undefined
  disabled: boolean
}

export function useSaveShortcut(
  action: (() => void) | undefined,
  disabled: boolean
) {
  const state = useRef<SaveShortcutState>({action, disabled})
  useLayoutEffect(() => {
    state.current = {action, disabled}
  }, [action, disabled])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== 's' ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey
      )
        return
      event.preventDefault()
      const current = state.current
      if (!current.disabled) current.action?.()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
