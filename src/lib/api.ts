import type { IpcResult } from "@/types/api"

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** Unwraps an IPC result, throwing an ApiError with the main-process message on failure. */
export async function call<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const res = await p
  if (!res || typeof res !== "object" || !("ok" in res)) throw new ApiError("BAD_RESPONSE", "Unexpected response from the app backend.")
  if (!res.ok) throw new ApiError(res.error.code, res.error.message)
  return res.data
}

export const api = () => window.api

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
