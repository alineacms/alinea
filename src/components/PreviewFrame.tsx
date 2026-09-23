import styler from '@alinea/styler'
import type {ReactNode, Ref} from 'react'
import {Toolbar as ToolbarPrimitive} from 'react-aria-components'
import {
  IcRoundArrowBack,
  IcRoundArrowForward,
  IcRoundOpenInNew,
  IcRoundRefresh
} from '../dashboard/icons.js'
import {Button} from './Button.js'
import css from './PreviewFrame.module.css'
import {Spinner} from './Spinner.js'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface PreviewFrameProps extends StyleProps, DataProps {
  /** The previewed url, leave out while it is unknown */
  src?: string
  /** Accessible title of the iframe */
  title: string
  /** Covers the frame with a spinner, eg. until the page has loaded */
  loading?: boolean
  /** Accessible label of the loading spinner, defaults to "Loading preview" */
  loadingLabel?: string
  /** Shown instead of the frame when there is no `src` and nothing loads */
  unavailable?: ReactNode
  /** The iframe sandbox tokens */
  sandbox?: string
  /** The iframe permissions policy */
  allow?: string
  onLoad?: () => void
  ref?: Ref<HTMLIFrameElement>
}

/** Renders a live preview of a page in an iframe filling the available space */
export function PreviewFrame({
  src,
  title,
  loading,
  loadingLabel = 'Loading preview',
  unavailable,
  sandbox,
  allow,
  onLoad,
  ref,
  className,
  ...props
}: PreviewFrameProps) {
  return (
    <div
      data-slot="preview-frame"
      {...props}
      className={styles.PreviewFrame(styler.merge({className}))}
    >
      {loading && (
        <div
          data-slot="preview-frame-loading"
          className={styles.PreviewFrame.loading()}
        >
          <Spinner aria-label={loadingLabel} />
        </div>
      )}
      {src ? (
        <iframe
          ref={ref}
          data-slot="preview-frame-iframe"
          className={styles.PreviewFrame.iframe()}
          title={title}
          src={src}
          sandbox={sandbox}
          allow={allow}
          onLoad={onLoad}
        />
      ) : (
        !loading &&
        unavailable && (
          <div
            data-slot="preview-frame-unavailable"
            className={styles.PreviewFrame.unavailable()}
          >
            {unavailable}
          </div>
        )
      )}
    </div>
  )
}

export interface PreviewToolbarLabels {
  back?: string
  forward?: string
  reload?: string
  open?: string
}

export interface PreviewToolbarProps extends StyleProps, AriaProps, DataProps {
  /** Navigates back in the preview, the button is disabled when left out */
  onBack?: () => void
  /** Navigates forward in the preview, the button is disabled when left out */
  onForward?: () => void
  /** Reloads the preview, the button is disabled when left out */
  onReload?: () => void
  /** Opens the preview elsewhere, the button is disabled when left out */
  onOpen?: () => void
  /** Shows a spinner in the reload button */
  reloading?: boolean
  /** Accessible labels of the buttons */
  labels?: PreviewToolbarLabels
  /** Extra controls, placed between the navigation and the open button */
  children?: ReactNode
}

/** Browser-like controls above a PreviewFrame */
export function PreviewToolbar({
  onBack,
  onForward,
  onReload,
  onOpen,
  reloading,
  labels,
  className,
  children,
  'aria-label': ariaLabel = 'Preview',
  ...props
}: PreviewToolbarProps) {
  return (
    <ToolbarPrimitive
      {...props}
      aria-label={ariaLabel}
      data-slot="preview-toolbar"
      className={styles.PreviewToolbar(styler.merge({className}))}
    >
      <div
        role="group"
        data-slot="preview-toolbar-navigation"
        className={styles.PreviewToolbar.navigation()}
      >
        <Button
          variant="ghost"
          size="icon"
          icon={IcRoundArrowBack}
          aria-label={labels?.back ?? 'Go back in preview'}
          disabled={!onBack}
          onClick={onBack}
        />
        <Button
          variant="ghost"
          size="icon"
          icon={IcRoundArrowForward}
          aria-label={labels?.forward ?? 'Go forward in preview'}
          disabled={!onForward}
          onClick={onForward}
        />
        <Button
          variant="ghost"
          size="icon"
          icon={IcRoundRefresh}
          aria-label={labels?.reload ?? 'Reload preview'}
          disabled={!onReload}
          loading={reloading}
          onClick={onReload}
        />
      </div>
      {children}
      <Button
        variant="ghost"
        size="icon"
        icon={IcRoundOpenInNew}
        aria-label={labels?.open ?? 'Open preview in new tab'}
        className={styles.PreviewToolbar.open()}
        disabled={!onOpen}
        onClick={onOpen}
      />
    </ToolbarPrimitive>
  )
}
