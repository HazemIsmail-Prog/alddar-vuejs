import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

function readStored(): ThemeMode | null {
  try {
    const value = localStorage.getItem('theme')
    if (value === 'dark' || value === 'light') return value
  } catch {
    /* ignore */
  }
  return null
}

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyThemeClass(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.setAttribute('data-theme', mode)
  const icon = mode === 'dark' ? '/icons/icon-192.png' : '/icons/icon-192-light.png'
  const apple = mode === 'dark' ? '/icons/apple-touch-icon.png' : '/icons/apple-touch-icon-light.png'
  const color = mode === 'dark' ? '#000000' : '#ffffff'
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
    link.href = icon
  })
  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = apple
  })
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = color
  })
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('light')

  function apply(next: ThemeMode) {
    mode.value = next
    applyThemeClass(next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    apply(mode.value === 'dark' ? 'light' : 'dark')
  }

  function init() {
    apply(readStored() ?? (prefersDark() ? 'dark' : 'light'))
  }

  return { mode, apply, toggle, init }
})
