import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
})

function captureCsrf(headers: Record<string, unknown> | undefined) {
  const token = headers?.['x-csrf-token'] ?? headers?.['X-CSRF-TOKEN']
  if (typeof token === 'string' && token) {
    api.defaults.headers.common['X-CSRF-TOKEN'] = token
  }
}

api.interceptors.response.use(
  (r) => {
    captureCsrf(r.headers)
    return r
  },
  async (error) => {
    const config = error.config
    if (error.response?.status === 419 && config && !config._csrfRetry) {
      config._csrfRetry = true
      await csrf()
      return api.request(config)
    }
    if (error.response?.status === 401 && useAuthStore().user) {
      const auth = useAuthStore()
      auth.clear()
      if (router.currentRoute.value.name !== 'login') {
        await router.push({ name: 'login' })
      }
    }
    if (error.response?.status === 403 && error.response?.data?.message?.includes('inactive')) {
      const auth = useAuthStore()
      auth.clear()
      if (router.currentRoute.value.name !== 'login') {
        await router.push({ name: 'login' })
      }
    }
    return Promise.reject(error)
  },
)

export async function csrf() {
  const { headers } = await api.get('/sanctum/csrf-cookie')
  captureCsrf(headers)
}

export default api
