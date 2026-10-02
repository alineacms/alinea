import {Button, FileTrigger} from '#/components.js'
import {
  type DashboardExplorer,
  explorerPageIsPending,
  type ExplorerReadyPage
} from '#/dashboard/atoms/explorer.js'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {IcRoundUploadFile} from '../icons.js'
import {ActivityStatus} from './ActivityStatus.js'

export interface OverviewUploadProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
}

/** Uploads files to the listed media folder, with the uploads in progress */
export function OverviewUpload({explorer, page}: OverviewUploadProps) {
  const requestedLocation = useAtomValueRaw(explorer.location)
  const selectedLocale = useAtomValueRaw(explorer.selectedLocale)
  const uploads = useAtomValueRaw(explorer.uploadsInCurrentFolder)
  const upload = useSetAtom(explorer.upload)
  if (!page.isMedia) return null
  const count = uploads.length
  const canUpload =
    page.canUpload &&
    !explorerPageIsPending(page, requestedLocation, selectedLocale)
  return (
    <>
      {count > 0 && (
        <ActivityStatus
          ariaLabel={
            count === 1 ? '1 file uploading' : `${count} files uploading`
          }
          side="bottom"
        >
          {count}
        </ActivityStatus>
      )}
      {canUpload && (
        <FileTrigger multiple onSelect={files => upload(files)}>
          <Button icon={IcRoundUploadFile} color="primary">
            Upload media
          </Button>
        </FileTrigger>
      )}
    </>
  )
}
