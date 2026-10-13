import {Button, Dialog, DialogTrigger, Field, Text} from '#/components.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {
  loadRedirectTargetAtom,
  redirectPicker,
  type RemovePlan
} from '#/dashboard/atoms/remove.js'
import {policyAtom} from '#/dashboard/atoms/user.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import {useRef, useTransition} from 'react'
import {IcRoundClose, IcRoundLink} from '../icons.js'
import {LinkPicker} from './LinkPicker.js'
import css from './RemoveRedirect.module.css'

const styles = styler(css)

export interface RemoveRedirectProps {
  plan: RemovePlan
  disabled?: boolean
}

/** Picks a page the URLs of the removed pages redirect to */
export function RemoveRedirect({plan, disabled}: RemoveRedirectProps) {
  const config = useAtomValueRaw(configAtom)
  const policy = useAtomValueRaw(policyAtom)
  const urls = useAtomValueRaw(plan.urls)
  const unredirected = useAtomValueRaw(plan.unredirected)
  const [target, setTarget] = useAtom(plan.redirect)
  const loadTarget = useSetAtom(loadRedirectTargetAtom)
  const [isLoading, startLoad] = useTransition()
  const anchor = useRef<HTMLDivElement>(null)
  if (urls.length === 0) return null
  const [first] = plan.subjects
  const {condition, locations, canSelect} = redirectPicker(
    config,
    policy,
    plan.subjects
  )
  const locales = new Set(
    unredirected.map(url => url.locale?.toUpperCase() ?? 'no language')
  )

  function pick(ids: Array<string>, locale: string | null) {
    const [id] = ids
    if (!id) return
    startLoad(async () => {
      const loaded = await loadTarget(id, locale)
      setTarget(loaded)
    })
  }

  return (
    <Field
      label={
        urls.length === 1
          ? 'Redirect the URL to another page (recommended)'
          : 'Redirect the URLs to another page (recommended)'
      }
    >
      <div ref={anchor} className={styles.RemoveRedirect()}>
        {target && (
          <div className={styles.RemoveRedirect.target()}>
            <Text truncate>{target.title}</Text>
            <Text size="sm" color="muted" truncate>
              {target.url}
            </Text>
          </div>
        )}
        <Dialog>
          <DialogTrigger
            variant="outline"
            size="sm"
            icon={IcRoundLink}
            disabled={disabled}
            loading={isLoading}
          >
            {target ? 'Change page' : 'Choose page…'}
          </DialogTrigger>
          <LinkPicker
            anchorRef={anchor}
            condition={condition}
            canSelect={canSelect}
            limitLocations={locations}
            location={{
              workspace: first.workspace,
              root: first.root,
              locale: first.locale ?? undefined
            }}
            initialResultMode="browse"
            nestedNavigation
            searchDepth="all"
            selectionMode="single"
            selectionBehavior="replace"
            onConfirm={pick}
          />
        </Dialog>
        {target && (
          <Button
            aria-label="Don't redirect"
            variant="ghost"
            size="icon-sm"
            icon={IcRoundClose}
            disabled={disabled}
            onClick={() => setTarget(undefined)}
          />
        )}
      </div>
      {target && locales.size > 0 && (
        <Text as="p" size="sm" color="warning">
          {`"${target.title}" isn't available in ${[...locales].join(', ')}, ` +
            `${unredirected.length === 1 ? 'that URL' : 'those URLs'} won't ` +
            'redirect.'}
        </Text>
      )}
    </Field>
  )
}
