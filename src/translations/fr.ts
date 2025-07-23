export const en = {
  app: {
    syncing: 'Syncing',
    synced: 'Synced',
    saving: 'Saving…'
  },
  urlPicker: {
    title: 'Link',
    url: 'Url',
    urlHelp: 'Url of the link',
    description: 'Description',
    descriptionHelp: 'Text to display inside the link element',
    target: 'Target',
    targetDescription: 'Open link in new tab',
    cancel: 'Cancel',
    confirm: 'Confirm'
  },
  pickLink: {
    title: 'Pick link',
    link: 'Link',
    description: 'Description',
    descriptionHelp: 'Text to display inside the link element',
    tooltip: 'Tooltip',
    tooltipHelp: 'Extra information that describes the link, shown on hover',
    newTab: 'Open link in new tab',
    remove: 'Remove link',
    cancel: 'Cancel',
    confirm: 'Confirm'
  },
  newEntry: {
    title: 'Title',
    parent: 'Parent',
    type: 'Select type',
    order: 'Insert order',
    orderFirst: 'At the top of the list',
    orderLast: 'At the bottom of the list',
    copyFrom: 'Copy content from',
    formTitle: 'New entry',
    cancel: 'Cancel',
    create: 'Create'
  },
  entryEdit: {
    blockingTitle: 'Are you sure you want to discard changes?',
    blockingWarning: 'This document was changed',
    blockingPrompt: 'would you like to save your changes?',
    blockingDiscard: 'Discard my changes',
    blockingSaveDraft: 'Save as draft',
    blockingPublishChanges: 'Publish changes',
    untranslatedTitle: 'Untranslated',
    untranslatedParent: 'Translate the parent page first.',
    untranslatedPrompt:
      'Enter the details below and save to start translating.',
    draftError: 'Could not complete draft action, please try again later',
    saveTranslationError:
      'Could not complete translate action, please try again later',
    publishError: 'Could not complete publish action, please try again later',
    discardError: 'Could not discard changes, please try again later',
    unpublishError:
      'Could not complete unpublish action, please try again later',
    deleteError: 'Could not complete delete action, please try again later',
    archiveError: 'Could not complete archive action, please try again later'
  },
  entryHeader: {
    draft: 'Draft',
    editing: 'Editing',
    published: 'Published',
    archived: 'Archived',
    untranslated: 'Untranslated',
    unpublished: 'Unpublished',
    revision: 'Revision',
    showMenu: 'Display menu',
    hideMenu: 'Hide menu',
    removeDraft: 'Remove draft',
    replace: 'Replace',
    delete: 'Delete',
    unpublish: 'Unpublish',
    archive: 'Archive',
    publish: 'Publish',
    showHistory: 'Show history',
    hideHistory: 'Hide history',
    draftAvailable: 'A newer draft version is available',
    translateFrom: 'Translate from',
    translateParent: 'Translate parent page first',
    discard: 'Discard edits',
    save: 'Save translation',
    saveDraft: 'Save',
    restore: 'Restore',
    showPreview: 'Display preview',
    hidePreview: 'Hide preview',
    savingDraft: 'Saving draft',
    savingTranslation: 'Saving translation',
    publishingEdits: 'Publishing edits',
    restoringRevision: 'Restoring revision',
    publishingDraft: 'Publishing draft',
    unpublishingDraft: 'Unpublishing draft',
    discardingDraft: 'Discarding draft',
    archivingPublished: 'Archiving published',
    publishingArchived: 'Publishing archived',
    deletingFile: 'Deleting file',
    deletingEntry: 'Delete entry'
  },
  contentView: {
    create: 'Create new'
  },
  welcome: {
    title: 'Your alinea installation is now ready for configuration.',
    button: 'Learn how to configure'
  },
  cloudAuthView: {
    title: 'Alinea',
    deploy: 'Ready to deploy?',
    handler: 'handler',
    continue: 'to continue',
    backend: 'Alinea requires a backend to continue.',
    customBackend: 'fully configure a custom backend',
    cloud: 'Or get set up in a few clicks with our cloud offering.',
    cloudButton: 'Continue with alinea.cloud'
  },
  sidebarSettings: {
    settings: 'Settings',
    defaultWorkspace: 'Default workspace',
    theme: 'Switch theme',
    fontSize: 'Font size',
    decreaseFontSize: 'Decrease font size',
    increaseFontSize: 'Increase font size',
    logout: 'Logout'
  },
  fileUploader: {
    uploadComplete(amount: number) {
      return `${amount} upload${amount > 1 ? 's' : ''} complete`
    },
    uploading(amount: number) {
      return `uploading ${amount} file${amount > 1 ? 's' : ''}`
    },
    upload: 'Upload files'
  },
  fileUploadRow: {
    alt: 'Uploaded file',
    done: 'Done'
  },
  fileEntry: {
    preview: 'Preview of media file',
    extension: 'Extension',
    fileSize: 'File size',
    dimensions: 'Dimensions',
    pixels: 'pixels',
    url: 'URL',
    focus: 'Focus point',
    focusHelp: 'Click on the image to change the focus point'
  },
  cardOverview: {
    title: 'card'
  },
  explorer: {
    noResults: 'No results'
  },
  editModeToggle: {
    edit: 'Edit',
    review: 'Review changes'
  },
  searchBox: {
    search: 'Search'
  },
  rootOverview: {
    instruction:
      'Select an entry in the navigation tree\non the left to start editing'
  },
  inputLabel: {
    readonly: 'Read-only',
    shared: 'Shared'
  },
  errorBoundary: {
    title: 'Error',
    oops: 'Oops, something went wrong',
    close: 'Close error',
    issue: 'Create an issue'
  },
  toolbar: {
    defaultWorkspace: 'Default workspace',
    logout: 'Logout'
  },
  listField: {
    reorder: 'Drag and drop to reorder',
    copy: 'Copy block',
    moveUp: 'Move up one position',
    moveDown: 'Move down one position',
    delete: 'Delete block',
    paste: 'Paste block',
    add: 'Insert new block'
  },
  metadataField: {
    previewTitle: 'Preview',
    searchEngine: 'Search engine',
    socialShare: 'Social share',
    ogImageAlt: 'Open Graph image'
  },
  pickTextLink: {
    title: 'Pick link',
    link: 'Link',
    description: 'Description',
    descriptionHelp: 'Text to display inside the link element',
    tooltip: 'Tooltip',
    tooltipHelp: 'Extra information that describes the link, shown on hover',
    newTab: 'Open link in new tab',
    remove: 'Remove link',
    cancel: 'Cancel',
    confirm: 'Confirm'
  },
  richTextField: {
    insert: 'Insert block'
  },
  richTextToolbar: {
    styles: 'Heading/paragraph',
    table: 'Table',
    bold: 'Bold',
    italic: 'Italic',
    align: 'Alignment',
    alignLeft: 'Align left',
    alignCenter: 'Align center',
    alignRight: 'Align right',
    alignJustify: 'Align justify',
    clear: 'Clear format',
    bulletList: 'Bullet list',
    orderedList: 'Ordered list',
    link: 'Link',
    quote: 'Blockquote',
    rule: 'Horizontal Rule',
    small: 'Small',
    sub: 'Subscript',
    sup: 'Superscript',
    paragraph: 'Normal text',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    h4: 'Heading 4',
    h5: 'Heading 5',
    tableLabel: 'Table',
    insert: 'Insert table',
    insertRowBefore: 'Insert row before',
    insertRowAfter: 'Insert row after',
    deleteRow: 'Delete row',
    toggleHeaderRow: 'Toggle header row',
    insertColumnBefore: 'Insert column before',
    insertColumnAfter: 'Insert column after',
    deleteColumn: 'Delete column',
    deleteTable: 'Delete table',
    left: 'Left',
    center: 'Center',
    right: 'Right',
    justify: 'Justify'
  },
  linkField: {
    reorder: 'Drag and drop to reorder',
    open: 'Open link in new tab',
    openFile: 'Open media file in new tab',
    edit: 'Edit link',
    editFile: 'Change image',
    delete: 'Delete link',
    deleteFile: 'Delete image'
  },
  entryPicker: {
    title: 'Select a reference',
    searchPlaceholder: 'Search',
    cancel: 'Cancel',
    confirm: 'Confirm'
  }
}
