/** Requests readwrite permission on a handle the moment the user actually asks to save — never ahead of time. */
export async function ensureWritePermission(handle: FileSystemFileHandle | FileSystemDirectoryHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return false
  const descriptor = { mode: 'readwrite' as const }
  const current = await handle.queryPermission(descriptor)
  if (current === 'granted') return true
  if (current === 'denied') return false
  const requested = await handle.requestPermission(descriptor)
  return requested === 'granted'
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
