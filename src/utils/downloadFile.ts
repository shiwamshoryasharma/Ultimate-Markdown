import { saveAs } from 'file-saver'

/** Used wherever the File System Access API isn't available (or the user chose it) — a real download, not a fake success. */
export function downloadTextFile(content: string, filename: string, mime = 'text/markdown;charset=utf-8'): void {
  saveAs(new Blob([content], { type: mime }), filename)
}

export function downloadBinaryFile(data: BlobPart, filename: string, mime = data instanceof Blob ? data.type : 'application/octet-stream'): void {
  saveAs(new Blob([data], { type: mime }), filename)
}
