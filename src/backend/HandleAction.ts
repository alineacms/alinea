export enum HandleAction {
  Auth = 'auth',
  Capabilities = 'capabilities',
  User = 'user',
  Resolve = 'resolve',
  Submit = 'submit',
  Submissions = 'submissions',
  SubmissionFile = 'submissionFile',
  FormUpload = 'formUpload',
  /** A mail or submission of a form the dev server hands to the app */
  FormEvent = 'formEvent',
  Pending = 'pending',
  Sync = 'sync',
  Draft = 'draft',
  History = 'history',
  PreviewToken = 'previewToken',
  Mutate = 'mutate',
  Upload = 'upload',
  Tree = 'tree',
  Sha = 'sha',
  Blob = 'blob'
}
