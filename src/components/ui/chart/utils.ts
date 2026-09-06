import { createApp, h, type Component } from 'vue'
import type { ChartConfig } from '.'

export function componentToString(
  config: ChartConfig,
  component: Component,
  extra: Record<string, unknown> = {},
) {
  return (d: unknown) => {
    const el = document.createElement('div')
    const payload = d && typeof d === 'object' && 'data' in (d as object)
      ? (d as { data: unknown }).data
      : d
    const app = createApp({
      render: () => h(component, { config, payload, ...extra }),
    })
    app.mount(el)
    const html = el.innerHTML
    app.unmount()
    return html
  }
}
