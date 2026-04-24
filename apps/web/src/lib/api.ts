import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"

import { getApiBaseUrl } from "@/lib/api-base-url"

const baseURL = getApiBaseUrl()

interface ApiRequestMeta {
  skipErrorToast?: boolean
}

export interface ApiRequestConfig<D = unknown> extends AxiosRequestConfig<D> {
  meta?: ApiRequestMeta
}

interface ApiInternalRequestConfig<D = unknown> extends InternalAxiosRequestConfig<D> {
  meta?: ApiRequestMeta
}

export class ApiClientError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

const client: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
})

client.interceptors.request.use((config: ApiInternalRequestConfig) => {
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"]
  }

  return config
})

client.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ error?: string }>) => {
    if (!error.response) {
      return Promise.reject(new ApiClientError("Network request failed.", 0, null))
    }

    const message =
      error.response.data?.error ||
      error.message ||
      "Request failed."

    return Promise.reject(
      new ApiClientError(message, error.response.status, error.response.data ?? null),
    )
  },
)

async function get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
  const response = await client.get<T>(url, config)
  return response.data
}

async function post<T, D = unknown>(
  url: string,
  data?: D,
  config?: ApiRequestConfig<D>,
): Promise<T> {
  const response = await client.post<T>(url, data, config)
  return response.data
}

async function patch<T, D = unknown>(
  url: string,
  data?: D,
  config?: ApiRequestConfig<D>,
): Promise<T> {
  const response = await client.patch<T>(url, data, config)
  return response.data
}

async function del<T>(url: string, config?: ApiRequestConfig): Promise<T> {
  const response = await client.delete<T>(url, config)
  return response.data
}

function skipErrorToast(): ApiRequestMeta {
  return { skipErrorToast: true }
}

export const api = {
  client,
  get,
  post,
  patch,
  delete: del,
}

export { baseURL as apiBaseUrl, skipErrorToast }
