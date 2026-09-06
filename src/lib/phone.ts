export const DEFAULT_COUNTRY_CODE = '+965'

export function normalizeCountryCode(code?: string | null) {
  const digits = String(code ?? '').replace(/\D/g, '') || '965'
  return `+${digits}`
}

export function formatPhone(p?: { country_code?: string | null; phone?: string | null; full_phone?: string | null } | null) {
  if (!p) return ''
  if (p.full_phone) return p.full_phone
  const number = String(p.phone ?? '').trim()
  if (!number) return ''
  return `${normalizeCountryCode(p.country_code)} ${number}`
}

export function phonePayload(p: { country_code?: string | null; phone?: string; is_primary?: boolean }) {
  return {
    country_code: normalizeCountryCode(p.country_code),
    phone: String(p.phone ?? '').trim(),
    is_primary: !!p.is_primary,
  }
}

export function blankPhoneInput() {
  return { country_code: DEFAULT_COUNTRY_CODE, phone: '' }
}

export function phoneDigits(p?: { country_code?: string | null; phone?: string | null; full_phone?: string | null } | null) {
  if (!p) return ''
  const local = String(p.phone ?? '').replace(/\D/g, '')
  if (local) {
    const cc = normalizeCountryCode(p.country_code).replace(/\D/g, '')
    return `${cc}${local}`
  }
  const digits = String(p.full_phone ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits : ''
}

export function telHref(p?: { country_code?: string | null; phone?: string | null; full_phone?: string | null } | null) {
  const digits = phoneDigits(p)
  return digits ? `tel:+${digits}` : ''
}

export function whatsappHref(p?: { country_code?: string | null; phone?: string | null; full_phone?: string | null } | null) {
  const digits = phoneDigits(p)
  return digits ? `https://wa.me/${digits}` : ''
}
