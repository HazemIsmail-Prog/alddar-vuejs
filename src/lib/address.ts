export const REQUIRED_ADDRESS_FIELDS = ['country', 'area', 'block', 'street'] as const

export type AddressFields = {
  country: string
  city: string
  area: string
  block: string
  street: string
  avenue: string
  building: string
  floor: string
  flat: string
  extras: string
  paci_number: string
  google_maps_link: string
}

export function blankAddress(overrides: Partial<AddressFields> = {}): AddressFields {
  return {
    country: 'الكويت',
    city: '',
    area: '',
    block: '',
    street: '',
    avenue: '',
    building: '',
    floor: '',
    flat: '',
    extras: '',
    paci_number: '',
    google_maps_link: '',
    ...overrides,
  }
}

export function addressComplete(loc: Partial<AddressFields> | null | undefined) {
  return REQUIRED_ADDRESS_FIELDS.every((field) => String(loc?.[field] ?? '').trim() !== '')
}

export function locationPayload(loc: any) {
  return {
    label: loc.label,
    country: String(loc.country ?? '').trim(),
    city: String(loc.city ?? '').trim(),
    area: String(loc.area ?? '').trim(),
    block: String(loc.block ?? '').trim(),
    street: String(loc.street ?? '').trim(),
    avenue: String(loc.avenue ?? '').trim() || null,
    building: String(loc.building ?? '').trim() || null,
    floor: String(loc.floor ?? '').trim() || null,
    flat: String(loc.flat ?? '').trim() || null,
    extras: String(loc.extras ?? '').trim() || null,
    paci_number: String(loc.paci_number ?? '').trim() === '' ? null : Number(loc.paci_number),
    google_maps_link: String(loc.google_maps_link ?? '').trim() || null,
  }
}
