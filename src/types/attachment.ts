export type AttachmentUser = {
  id?: number
  name_en?: string | null
  name_ar?: string | null
}

export type AttachmentRecord = {
  id: number
  kind: string
  original_name: string
  mime: string
  size: number
  created_at?: string | null
  user?: AttachmentUser | null
}
