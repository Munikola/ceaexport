import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const baseURL = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// Inyecta JWT en cada request si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Refresh automático en 401 (excepto para los endpoints de auth)
let isRefreshing = false
let pendingQueue: Array<(token: string | null) => void> = []

function flushQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token))
  pendingQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error)
    }

    const refresh = localStorage.getItem('refresh_token')
    if (!refresh) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((token) => {
          if (!token) reject(error)
          else {
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          }
        })
      })
    }

    original._retry = true
    isRefreshing = true
    try {
      const res = await axios.post<{ access_token: string; refresh_token: string }>(
        `${baseURL}/api/auth/refresh`,
        { refresh_token: refresh },
      )
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      flushQueue(res.data.access_token)
      original.headers.Authorization = `Bearer ${res.data.access_token}`
      return api(original)
    } catch (refreshError) {
      flushQueue(null)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
