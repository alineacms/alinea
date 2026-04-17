import {
  IcAlineaLogo as IcRoundHome,
  IcBaselineAccountCircle as IcRoundAccountCircle,
  IcBaselineContentCopy as IcRoundContentCopy,
  IcOutlineCloudUpload as IcRoundCloudUpload,
  IcOutlineGridView as IcRoundGridView,
  IcOutlineSettings as IcRoundSettings,
  IcOutlineTableRows as IcRoundViewList,
  IcOutlineDescription,
  IcRoundAddCircle,
  IcRoundArchive,
  IcRoundArrowBack,
  IcRoundArrowForward,
  IcRoundBrightness2 as IcRoundBrightness,
  IcRoundCheck,
  IcRoundClose,
  IcRoundDelete,
  IcRoundDescription,
  IcRoundEdit,
  IcRoundFormatAlignLeft,
  IcRoundFormatBold,
  IcRoundHistory,
  IcRoundDescription as IcRoundInfo,
  IcRoundKeyboardArrowDown,
  IcRoundKeyboardArrowLeft,
  IcRoundKeyboardArrowRight,
  IcRoundKeyboardArrowUp,
  IcRoundKeyboardTab,
  IcRoundLanguage,
  IcRoundLink,
  IcRoundLogout,
  IcRoundMoreVert,
  IcRoundOpenInNew,
  IcRoundPermMedia,
  IcRoundRedo,
  IcRoundRefresh,
  IcRoundSearch,
  IcRoundShare,
  IcRoundTextFields,
  IcRoundTranslate,
  IcRoundArchive as IcRoundUnarchive,
  IcRoundUndo,
  IcRoundUnfoldMore,
  IcRoundVisibility,
  IcRoundVisibilityOff,
  IcRoundVisibilityOff as IcRoundUnpublished,
  IcRoundUploadFile as IcRoundUpload,
  IcOutlineGridView as IcRoundViewModule,
  IcRoundClose as IcRoundCancel
} from '../v2/icons.js'
import {Icon} from './Icon.js'

const icons = [
  {icon: IcOutlineDescription, name: 'IcOutlineDescription'},
  {icon: IcRoundAccountCircle, name: 'IcRoundAccountCircle'},
  {icon: IcRoundAddCircle, name: 'IcRoundAddCircle'},
  {icon: IcRoundArchive, name: 'IcRoundArchive'},
  {icon: IcRoundArrowBack, name: 'IcRoundArrowBack'},
  {icon: IcRoundArrowForward, name: 'IcRoundArrowForward'},
  {icon: IcRoundFormatBold, name: 'IcRoundFormatBold'},
  {icon: IcRoundBrightness, name: 'IcRoundBrightness'},
  {icon: IcRoundCancel, name: 'IcRoundCancel'},
  {icon: IcRoundCheck, name: 'IcRoundCheck'},
  {icon: IcRoundClose, name: 'IcRoundClose'},
  {icon: IcRoundCloudUpload, name: 'IcRoundCloudUpload'},
  {icon: IcRoundContentCopy, name: 'IcRoundContentCopy'},
  {icon: IcRoundDelete, name: 'IcRoundDelete'},
  {icon: IcRoundDescription, name: 'IcRoundDescription'},
  {icon: IcRoundEdit, name: 'IcRoundEdit'},
  {icon: IcRoundFormatAlignLeft, name: 'IcRoundFormatAlignLeft'},
  {icon: IcRoundGridView, name: 'IcRoundGridView'},
  {icon: IcRoundHistory, name: 'IcRoundHistory'},
  {icon: IcRoundHome, name: 'IcRoundHome'},
  {icon: IcRoundInfo, name: 'IcRoundInfo'},
  {icon: IcRoundKeyboardArrowDown, name: 'IcRoundKeyboardArrowDown'},
  {icon: IcRoundKeyboardArrowLeft, name: 'IcRoundKeyboardArrowLeft'},
  {icon: IcRoundKeyboardArrowRight, name: 'IcRoundKeyboardArrowRight'},
  {icon: IcRoundKeyboardArrowUp, name: 'IcRoundKeyboardArrowUp'},
  {icon: IcRoundKeyboardTab, name: 'IcRoundKeyboardTab'},
  {icon: IcRoundLanguage, name: 'IcRoundLanguage'},
  {icon: IcRoundLink, name: 'IcRoundLink'},
  {icon: IcRoundLogout, name: 'IcRoundLogout'},
  {icon: IcRoundMoreVert, name: 'IcRoundMoreVert'},
  {icon: IcRoundOpenInNew, name: 'IcRoundOpenInNew'},
  {icon: IcRoundPermMedia, name: 'IcRoundPermMedia'},
  {icon: IcRoundRedo, name: 'IcRoundRedo'},
  {icon: IcRoundRefresh, name: 'IcRoundRefresh'},
  {icon: IcRoundSearch, name: 'IcRoundSearch'},
  {icon: IcRoundSettings, name: 'IcRoundSettings'},
  {icon: IcRoundShare, name: 'IcRoundShare'},
  {icon: IcRoundTextFields, name: 'IcRoundTextFields'},
  {icon: IcRoundTranslate, name: 'IcRoundTranslate'},
  {icon: IcRoundUnarchive, name: 'IcRoundUnarchive'},
  {icon: IcRoundUndo, name: 'IcRoundUndo'},
  {icon: IcRoundUnfoldMore, name: 'IcRoundUnfoldMore'},
  {icon: IcRoundUnpublished, name: 'IcRoundUnpublished'},
  {icon: IcRoundUpload, name: 'IcRoundUpload'},
  {icon: IcRoundViewList, name: 'IcRoundViewList'},
  {icon: IcRoundViewModule, name: 'IcRoundViewModule'},
  {icon: IcRoundVisibility, name: 'IcRoundVisibility'},
  {icon: IcRoundVisibilityOff, name: 'IcRoundVisibilityOff'}
]

export const Example = () => (
  <div style={{columns: 3}}>
    {icons.map(({icon, name}) => (
      <div
        key={name}
        style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16}}
      >
        <Icon icon={icon} />
        <p>{name}</p>
      </div>
    ))}
  </div>
)

export default {
  title: 'Components / Icon'
}
