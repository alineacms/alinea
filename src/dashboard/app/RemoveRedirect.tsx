import {Text} from '#/components.js'
import {Type, type} from '#/core/Type.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  loadRedirectTargetAtom,
  redirectPicker,
  type RemovePlan
} from '#/dashboard/atoms/remove.js'
import {EditorScope} from '#/dashboard/hooks.js'
import {entry} from '#/field/link.js'
import type {EntryReference} from '#/picker/entry/EntryReference.js'
import {useAtom, useAtomValueRaw, useSetAtom, useStore} from 'jotai'
import {useEffect, useMemo, useState} from 'react'
import {BlockSheetBoundary} from './BlockSheet.js'
import {EditField} from './EntryFields.js'

export interface RemoveRedirectProps {
  plan: RemovePlan
  disabled?: boolean
}

interface RedirectValue {
  redirect?: EntryReference
}

/** Picks a page the URLs of the removed pages redirect to */
export function RemoveRedirect({plan, disabled}: RemoveRedirectProps) {
  const config = useAtomValueRaw(configAtom)
  const urls = useAtomValueRaw(plan.urls)
  const unredirected = useAtomValueRaw(plan.unredirected)
  const [target, setTarget] = useAtom(plan.redirect)
  const loadTarget = useSetAtom(loadRedirectTargetAtom)
  const store = useStore()
  const several = urls.length > 1
  const form = useMemo(() => {
    const [first] = plan.subjects
    const {condition, locations} = redirectPicker(config, plan.subjects)
    const label = several
      ? 'Redirect the URLs to another page (recommended)'
      : 'Redirect the URL to another page (recommended)'
    return type('Redirect', {
      fields: {
        redirect: entry(label, {
          condition,
          limitLocations: locations,
          location: {
            workspace: first.workspace,
            root: first.root,
            locale: first.locale ?? undefined
          },
          enableNavigation: true
        })
      }
    })
  }, [config, plan, several])
  const [node] = useState(
    () => new ReactiveNode(Type.initialValue(form) as RedirectValue)
  )
  const editor = useMemo(
    () =>
      new EntryEditor(
        form,
        node,
        undefined,
        undefined,
        undefined,
        undefined,
        disabled
      ),
    [form, node, disabled]
  )
  useEffect(
    () =>
      store.sub(node.value, async () => {
        const link = store.get(node.value).redirect
        if (!link) return setTarget(undefined)
        const locale = link._locale ?? plan.subjects[0].locale
        const loaded = await loadTarget(link._entry, locale)
        // A later pick replaces this one
        if (store.get(node.value).redirect === link) setTarget(loaded)
      }),
    [store, node, plan, loadTarget, setTarget]
  )
  if (urls.length === 0) return null
  const locales = new Set(
    unredirected.map(url => url.locale?.toUpperCase() ?? 'no language')
  )
  return (
    <BlockSheetBoundary>
      <EditorScope editor={editor}>
        <EditField field={form.redirect} />
      </EditorScope>
      {target && locales.size > 0 && (
        <Text as="p" size="sm" color="warning">
          {`"${target.title}" isn't available in ${[...locales].join(', ')}, ` +
            `${unredirected.length === 1 ? 'that URL' : 'those URLs'} won't ` +
            'redirect.'}
        </Text>
      )}
    </BlockSheetBoundary>
  )
}
