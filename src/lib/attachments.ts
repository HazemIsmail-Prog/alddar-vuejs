import api from '@/api/client'

const urls = new Map<number, string>()

export async function attachmentObjectUrl(id: number): Promise<string> {
  const cached = urls.get(id)
  if (cached) return cached
  const res = await api.get(`/api/attachments/${id}`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  urls.set(id, url)
  return url
}

export async function downloadAttachment(id: number, name: string) {
  const url = await attachmentObjectUrl(id)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

export function forgetAttachmentUrl(id: number) {
  const url = urls.get(id)
  if (url) URL.revokeObjectURL(url)
  urls.delete(id)
}
