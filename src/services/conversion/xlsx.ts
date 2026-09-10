import type { ExportModel } from './model'
import { nodeText, walkElements } from './model'
import { escapeHtml } from './html'

export function extractTables(model: ExportModel): string[][][] {
  const tables: string[][][] = []
  for (const doc of model.documents) walkElements(doc.tree, (node) => {
    if (node.tagName !== 'table') return
    const rows: string[][] = []
    walkElements(node, (row) => {
      if (row.tagName === 'tr') rows.push(row.children.filter((cell) => cell.type === 'element' && ['th', 'td'].includes(cell.tagName)).map(nodeText))
    })
    if (rows.length) tables.push(rows)
  })
  return tables
}
function columnName(index: number): string {
  let label = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label
  return label
}
const xml = (text: string) => escapeHtml(text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''))

/** A narrow write-only OOXML table exporter. Values are inline strings, never
 * formulas, so =HYPERLINK(...) from a document cannot execute in Excel. */
export async function exportXlsx(model: ExportModel): Promise<Blob> {
  const tables = extractTables(model)
  if (!tables.length) throw new Error('No Markdown tables detected. Select a document containing a table.')
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const rel = 'http://schemas.openxmlformats.org/package/2006/relationships'
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tables.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  zip.file('_rels/.rels', `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file('xl/workbook.xml', `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tables.map((_, i) => `<sheet name="Table ${i + 1}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<Relationships xmlns="${rel}">${tables.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`)
  tables.forEach((rows, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<worksheet xmlns="${ns}"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' })
}
