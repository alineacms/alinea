import type {Request, Response} from '@alinea/iso'
import type {CommitRequest} from './db/CommitRequest.js'
import type {Mutation} from './db/Mutation.js'
import type {Draft, DraftKey} from './Draft.js'
import type {EntryRecord} from './EntryRecord.js'
import type {AnyQueryResult, GraphQuery} from './Graph.js'
import type {GetBlobsOptions} from './source/Source.js'
import type {ReadonlyTree} from './source/Tree.js'
import type {User, UserInput} from './User.js'

export interface AuthApi {
  authenticate(request: Request, options: AuthOptions): Promise<Response>
  verify(request: Request): Promise<AuthedContext>
}

export interface AuthOptions {
  authenticated(user: User): Promise<AuthenticatedUser>
}

export interface AuthenticatedUser {
  user: User
  capabilities: BackendCapabilities
}

export interface UserApi {
  enrichUser(user: User): Promise<User>
  listUsers(): Promise<Array<User>>
  createUser(user: UserInput): Promise<User>
  updateUser(request: UserInput): Promise<User>
  removeUser(email: string): Promise<void>
}

export interface BackendCapabilities {
  users: boolean
}

export interface CapabilitiesApi {
  capabilities(): Promise<BackendCapabilities>
}

export interface RemoteConnection
  extends Connection, AuthApi, CapabilitiesApi {}

export interface BrowserConnection extends Connection {
  logout?(): Promise<void>
}

/** A handler seen from the dashboard or an app: it commits by mutating. */
export interface LocalConnection
  extends SyncApi, HistoryApi, DraftsApi, UploadsApi, UserApi, CapabilitiesApi {
  mutate(mutations: Array<Mutation>): Promise<{sha: string}>
  previewToken(): Promise<string>
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>>
  user(): Promise<User | undefined>
  /** The submissions of a form entry, the latest first */
  submissions(entryId: string): Promise<Array<Submission>>
  updateSubmission(
    entryId: string,
    id: string,
    status: SubmissionStatus
  ): Promise<void>
  deleteSubmission(entryId: string, id: string): Promise<void>
  /** A file of a submission, for editors who can read its form */
  submissionFile(entryId: string, id: string): Promise<Blob>
}

export interface SyncApi {
  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined>
  getBlobs(
    shas: ReadonlyArray<string>,
    options?: GetBlobsOptions
  ): AsyncIterable<[sha: string, blob: Uint8Array]>
}

export interface CommitApi {
  write(request: CommitRequest): Promise<{sha: string}>
}

export interface HistoryApi {
  revisions(file: string): Promise<Array<Revision>>
  revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined>
}

export interface DraftsApi {
  getDraft(draftKey: DraftKey): Promise<Draft | undefined>
  storeDraft(draft: Draft): Promise<void>
}

export interface UploadsApi {
  prepareUpload(
    file: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse>
  handleUpload?(entryId: string, file: Blob): Promise<void>
  previewUpload?(entryId: string): Promise<Response>
}

/** The answers sent for a form, as they are stored */
export interface Submission {
  id: string
  /** The id of the entry holding the form */
  entryId: string
  locale: string | null
  /** The key of the form field in the entry */
  field: string
  /** The answers by the key of their input */
  values: Record<string, unknown>
  /** The form as it was sent, so the answers keep their labels */
  definition: unknown
  /** When it was sent, in seconds */
  createdAt: number
  status: SubmissionStatus
  /** The names of the notification mails that were sent for it */
  notified?: Array<string> | null
}

export type SubmissionStatus = 'new' | 'read' | 'archived'

/** A file a visitor added to a file input, as the answer refers to it */
export interface FormFileRef {
  id: string
  name: string
  size: number
  type: string
}

/** A file of a form as it is stored */
export interface StoredFormFile extends FormFileRef {
  entryId: string
  /** The key of the file input */
  input: string
  /** The submission it belongs to, null until it is submitted */
  submissionId: string | null
  content: Uint8Array
  /** When it was uploaded, in seconds */
  createdAt: number
}

/** What a site asks for before a visitor uploads a file to a form */
export interface PrepareUploadRequest {
  entryId: string
  locale?: string | null
  field?: string
  /** The key of the file input */
  input: string
  name: string
  size: number
  type: string
}

/** Where to upload the file, and the token the submission refers to it by */
export type PrepareUploadResult =
  | {ok: true; url: string; method: 'PUT'; token: string}
  | {ok: false; message: string}

/** What a site sends to the handler for a visitor's answers */
export interface SubmitRequest {
  /** The id of the entry holding the form */
  entryId: string
  locale?: string | null
  /** The key of the form field, the first one of the entry by default */
  field?: string
  /** The FormData the visitor sent, as its entries */
  data: Array<[string, string]>
}

/** What the handler answers to a submission */
export type SubmitResult =
  | {
      ok: true
      /** The message to show instead of the form */
      confirmation?: string
      /** The url of the page to go to instead */
      redirect?: string
    }
  | {ok: false; errors?: Record<string, string>; message?: string}

export interface SubmissionsApi {
  storeSubmission?(submission: Submission): Promise<void>
  /** The submissions of a form, the latest first */
  listSubmissions?(entryId: string): Promise<Array<Submission>>
  updateSubmission?(
    entryId: string,
    id: string,
    status: SubmissionStatus
  ): Promise<void>
  deleteSubmission?(entryId: string, id: string): Promise<void>
  /** Keeps an uploaded file until it is submitted, or a day at most */
  storeFormFile?(file: StoredFormFile): Promise<void>
  /** The files of a form with these ids, without their content */
  formFiles?(
    entryId: string,
    ids: Array<string>
  ): Promise<Array<Omit<StoredFormFile, 'content'>>>
  attachFormFiles?(
    entryId: string,
    submissionId: string,
    ids: Array<string>
  ): Promise<void>
  readFormFile?(
    entryId: string,
    id: string
  ): Promise<StoredFormFile | undefined>
}

export interface Connection
  extends
    CommitApi,
    SyncApi,
    HistoryApi,
    DraftsApi,
    UploadsApi,
    UserApi,
    SubmissionsApi {}

export interface RequestContext {
  isDev: boolean
  handlerUrl: URL
  apiKey: string
  /**
   * Origin serving the public files of this build when it is not the
   * configured baseUrl, such as the local server of `next start`
   */
  publicUrl?: URL
  applyAuth?(init?: RequestInit): RequestInit
}

export const developmentKeyHeader = 'x-alinea-dev-key'
/** Marks a mutation an app sends back to the dev server after its hooks ran. */
export const forwardedMutationHeader = 'x-alinea-forwarded'

export interface AuthedContext extends RequestContext {
  user: User
  token: string
}

export interface Revision {
  ref: string
  createdAt: number
  file: string
  user?: {name: string; email: string}
  description?: string
}

export interface UploadDestination {
  entryId: string
  location: string
  previewUrl: string
}

export interface UploadMetadata {
  size: number
}

export interface UploadResponse extends UploadDestination {
  url: string
  method?: string
  /** Extra headers to send with the upload */
  headers?: Record<string, string>
}

/**
 * Adds the development key to an upload to the dev server, which requires it
 * from callers that send no Origin, such as server code (browsers send one)
 */
export function withDevelopmentKey(
  upload: UploadResponse,
  apiKey: string
): UploadResponse {
  if (!new URL(upload.url).search.startsWith('?/upload')) return upload
  return {
    ...upload,
    headers: {...upload.headers, [developmentKeyHeader]: apiKey}
  }
}

export interface DraftTransport {
  entryId: string
  locale: string | null
  commitHash: string
  fileHash: string
  draft: string
}
