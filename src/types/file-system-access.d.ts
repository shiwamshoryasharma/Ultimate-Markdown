/*
  Minimal ambient typings for the File System Access API (showOpenFilePicker,
  showDirectoryPicker, FileSystemDirectoryHandle, etc). Not fully declared by
  every TypeScript DOM lib version, so declared here to avoid depending on
  lib coverage. All call sites still runtime-feature-detect before use —
  these types only make the code compile, they don't imply the API exists.
*/

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  readonly kind: 'file' | 'directory'
  readonly name: string
  isSameEntry(other: FileSystemHandle): Promise<boolean>
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>
  seek(position: number): Promise<void>
  truncate(size: number): Promise<void>
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file'
  getFile(): Promise<File>
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory'
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
  keys(): AsyncIterableIterator<string>
  values(): AsyncIterableIterator<FileSystemHandle>
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>
}

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface OpenFilePickerOptions {
  multiple?: boolean
  excludeAcceptAllOption?: boolean
  types?: FilePickerAcceptType[]
}

interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite'
  id?: string
  startIn?: FileSystemHandle | string
}

interface SaveFilePickerOptions {
  suggestedName?: string
  excludeAcceptAllOption?: boolean
  types?: FilePickerAcceptType[]
}

/** Cast `window` to this where the File System Access API is used, after feature-detecting. */
interface FileSystemAccessWindow extends Window {
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
}

/** Cast a drag-and-drop DataTransferItem to this to reach getAsFileSystemHandle where supported. */
interface DataTransferItemWithHandle extends DataTransferItem {
  getAsFileSystemHandle(): Promise<FileSystemHandle | null>
}
