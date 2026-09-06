import type { AttachmentRecord, AttachmentUser } from './attachment'

export type CommentPage = {
  comments: CommentRecord[]
  has_more: boolean
}

export type CommentRecord = {
  id: number
  kind?: string | null
  body?: string | null
  created_at?: string | null
  user?: AttachmentUser | null
  attachments?: AttachmentRecord[]
  read_by?: AttachmentUser[]
}
