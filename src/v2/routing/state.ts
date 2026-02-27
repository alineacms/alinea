import type {Config} from 'alinea/core/Config'
import {Workspace} from 'alinea/core/Workspace'
import {useCallback, useEffect, useMemo, useState, useTransition} from 'react'

export interface RouteState {
  workspace: string
  root: string
  entryId?: string
}

function sameRoute(a: RouteState, b: RouteState): boolean {
  return (
    a.workspace === b.workspace &&
    a.root === b.root &&
    (a.entryId ?? undefined) === (b.entryId ?? undefined)
  )
}

function firstRoute(config: Config): RouteState {
  const [workspaceName, workspace] = Object.entries(config.workspaces)[0]
  const roots = Workspace.data(workspace).roots
  const [rootName] = Object.keys(roots)
  return {workspace: workspaceName, root: rootName}
}

function hasWorkspace(config: Config, workspace: string): boolean {
  return Boolean(config.workspaces[workspace])
}

function hasRoot(config: Config, workspace: string, root: string): boolean {
  const ws = config.workspaces[workspace]
  if (!ws) return false
  return Boolean(Workspace.data(ws).roots[root])
}

function sanitizeRoute(config: Config, route: RouteState): RouteState {
  const fallback = firstRoute(config)
  const workspace = hasWorkspace(config, route.workspace)
    ? route.workspace
    : fallback.workspace
  const root = hasRoot(config, workspace, route.root) ? route.root : fallback.root
  return {workspace, root, entryId: route.entryId}
}

export function parseRoute(config: Config, path: string): RouteState {
  const fallback = firstRoute(config)
  const cleanPath = path.replace(/\/+$/, '') || '/'
  const segments = cleanPath.split('/').filter(Boolean)
  if (segments.length === 0) return fallback

  if (segments[0] === 'entry') {
    const workspace = segments[1] ?? fallback.workspace
    const root = segments[2] ?? fallback.root
    const entryId = segments[3]
    return sanitizeRoute(config, {workspace, root, entryId})
  }

  if (segments[0] === 'root') {
    const workspace = segments[1] ?? fallback.workspace
    const root = segments[2] ?? fallback.root
    return sanitizeRoute(config, {workspace, root})
  }

  return fallback
}

export function routeToPath(route: RouteState): string {
  if (route.entryId)
    return `/entry/${route.workspace}/${route.root}/${route.entryId}`
  return `/root/${route.workspace}/${route.root}`
}

export function useRouteState(config: Config) {
  const initial = useMemo(() => {
    if (typeof window === 'undefined') return firstRoute(config)
    return parseRoute(config, window.location?.pathname ?? '/')
  }, [config])
  const [route, setRoute] = useState<RouteState>(initial)
  const [isNavigating, startTransition] = useTransition()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => {
      setRoute(parseRoute(config, window.location?.pathname ?? '/'))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [config])

  const navigate = useCallback(
    (next: RouteState, replace = false) => {
      const target = sanitizeRoute(config, next)
      const targetPath = routeToPath(target)
      if (typeof window === 'undefined') {
        setRoute(current => (sameRoute(current, target) ? current : target))
        return
      }
      startTransition(() => {
        const currentPath = window.location?.pathname ?? '/'
        if (currentPath === targetPath) {
          setRoute(current => (sameRoute(current, target) ? current : target))
          return
        }
        if (replace) window.history.replaceState(null, '', targetPath)
        else window.history.pushState(null, '', targetPath)
        setRoute(current => (sameRoute(current, target) ? current : target))
      })
    },
    [config]
  )

  return {route, navigate, isNavigating}
}
