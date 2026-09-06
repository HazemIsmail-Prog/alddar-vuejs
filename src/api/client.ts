import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
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
  await api.get('/sanctum/csrf-cookie')
}

export default api
