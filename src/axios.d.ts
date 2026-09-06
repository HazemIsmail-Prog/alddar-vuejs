import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    _csrfRetry?: boolean
  }
}
