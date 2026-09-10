export type OutputFormat = 'pdf' | 'docx' | 'html' | 'txt' | 'xlsx'
export interface ConversionSettings {
  format: OutputFormat
  sourceMode: 'current' | 'linked-chain' | 'selected' | 'workspace'
  fontFamily: string
  bodyFontSize: number
  headingSizes: [number, number, number, number, number, number]
  codeFontSize: number
  paragraphSpacing: number
  pageColor: string
  textColor: string
  headingColor: string
  linkColor: string
  columns: 1 | 2 | 3
  columnGap: number
  theme: string
  lineHeight: number
  pageSize: 'A4' | 'A3' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  margins: { top: number; right: number; bottom: number; left: number }
  alignment: 'left' | 'justify'
  tableStyle: 'simple' | 'grid' | 'minimal'
  codeStyle: 'light' | 'dark' | 'minimal'
  documentCss: boolean
  header: { enabled: boolean; text: string }
  footer: { enabled: boolean; customText: string; pageNumbers: boolean; pageNumberFormat: 'number' | 'page' | 'page-total' | 'fraction'; alignment: 'left' | 'center' | 'right' }
  internalMarkdownLinks: 'keep' | 'hide-if-included'
  linkedDocumentSeparation: 'continuous' | 'new-page'
}
export const FONTS = ['Aptos', 'Arial', 'Baskerville', 'Book Antiqua', 'Calibri', 'Cambria', 'Candara', 'Century Schoolbook', 'Constantia', 'Corbel', 'Courier New', 'Garamond', 'Georgia', 'Helvetica', 'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana']
export const DOCUMENT_THEMES = [
  { id: 'classic', name: 'Classic', pageColor: '#ffffff', textColor: '#263244', headingColor: '#203e67', linkColor: '#315acb', fontFamily: 'Arial' },
  { id: 'parchment', name: 'Parchment', pageColor: '#fff8dc', textColor: '#493d2c', headingColor: '#765029', linkColor: '#806122', fontFamily: 'Georgia' },
  { id: 'botanical', name: 'Botanical', pageColor: '#f3f8ef', textColor: '#293f34', headingColor: '#21644b', linkColor: '#287456', fontFamily: 'Cambria' },
  { id: 'editorial', name: 'Editorial', pageColor: '#fffaf5', textColor: '#35302e', headingColor: '#a13b45', linkColor: '#ad3c55', fontFamily: 'Garamond' },
  { id: 'ocean', name: 'Ocean', pageColor: '#f0f7ff', textColor: '#223849', headingColor: '#12577a', linkColor: '#176cac', fontFamily: 'Calibri' },
  { id: 'lavender', name: 'Lavender', pageColor: '#f9f5ff', textColor: '#40344d', headingColor: '#714795', linkColor: '#7952a3', fontFamily: 'Constantia' },
] as const
export const DOCUMENT_STYLES = {
  documentation: { name: 'Documentation', bodyFontSize: 11, headingSizes: [24, 19, 16, 14, 12, 11], lineHeight: 1.45, paragraphSpacing: 8, columns: 1 },
  article: { name: 'Article', bodyFontSize: 12, headingSizes: [28, 21, 17, 14, 12, 12], lineHeight: 1.55, paragraphSpacing: 10, columns: 1 },
  newsletter: { name: 'Newsletter', bodyFontSize: 10, headingSizes: [22, 17, 14, 12, 11, 10], lineHeight: 1.35, paragraphSpacing: 7, columns: 2 },
  letter: { name: 'Letter', bodyFontSize: 12, headingSizes: [20, 17, 15, 14, 12, 12], lineHeight: 1.5, paragraphSpacing: 12, columns: 1 },
  paper: { name: 'Paper', bodyFontSize: 10, headingSizes: [18, 14, 12, 11, 10, 10], lineHeight: 1.25, paragraphSpacing: 6, columns: 2 },
} satisfies Record<string, { name: string } & Pick<ConversionSettings, 'bodyFontSize' | 'headingSizes' | 'lineHeight' | 'paragraphSpacing' | 'columns'>>
export const PAGE_SIZES = { A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6] } as const
export const DEFAULT_CONVERSION: ConversionSettings = {
  format: 'pdf', sourceMode: 'linked-chain', fontFamily: 'Arial', bodyFontSize: 12, lineHeight: 1.5,
  headingSizes: [26, 20, 16, 14, 12, 12], codeFontSize: 10, paragraphSpacing: 9,
  pageColor: '#ffffff', textColor: '#263244', headingColor: '#203e67', linkColor: '#315acb', columns: 1, columnGap: 8, theme: 'classic',
  pageSize: 'A4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 },
  alignment: 'left', tableStyle: 'simple', codeStyle: 'light', documentCss: true,
  header: { enabled: false, text: '' },
  footer: { enabled: false, customText: '', pageNumbers: true, pageNumberFormat: 'page-total', alignment: 'center' },
  internalMarkdownLinks: 'hide-if-included', linkedDocumentSeparation: 'new-page',
}
export function pageDimensions(s: ConversionSettings): [number, number] {
  const [w, h] = PAGE_SIZES[s.pageSize]
  return s.orientation === 'landscape' ? [h, w] : [w, h]
}
export function validateConversion(s: ConversionSettings): string | null {
  if (s.headingSizes.some((n) => !Number.isFinite(n) || n < 8 || n > 72)) return 'Heading sizes must be between 8 and 72 pt.'
  if (!Number.isFinite(s.codeFontSize) || s.codeFontSize < 6 || s.codeFontSize > 48) return 'Code size must be between 6 and 48 pt.'
  if (!Number.isFinite(s.paragraphSpacing) || s.paragraphSpacing < 0 || s.paragraphSpacing > 48) return 'Paragraph spacing must be between 0 and 48 pt.'
  if (![s.pageColor, s.textColor, s.headingColor, s.linkColor].every((c) => /^#[0-9a-f]{6}$/i.test(c))) return 'Choose valid page and font colours.'
  if (![1, 2, 3].includes(s.columns) || !Number.isFinite(s.columnGap) || s.columnGap < 3 || s.columnGap > 25) return 'Choose 1–3 columns with a gap of 3–25 mm.'
  if (!FONTS.includes(s.fontFamily) || !Number.isFinite(s.bodyFontSize) || s.bodyFontSize < 8 || s.bodyFontSize > 48) return 'Choose a supported font and size between 8 and 48 pt.'
  if (!Number.isFinite(s.lineHeight) || s.lineHeight < 1 || s.lineHeight > 3) return 'Line spacing must be between 1 and 3.'
  if (Object.values(s.margins).some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return 'Margins must be between 0 and 100 mm.'
  const [w, h] = pageDimensions(s)
  if ((w - s.margins.left - s.margins.right - (s.columns - 1) * s.columnGap) / s.columns < 30) return 'Columns are too narrow. Reduce margins, column count, or column gap.'
  if (s.margins.left + s.margins.right > w - 40 || s.margins.top + s.margins.bottom > h - 40) return 'Margins leave too little space for document content.'
  if (s.header.enabled && s.margins.top < 12) return 'Use a top margin of at least 12 mm for the header.'
  if (s.footer.enabled && s.margins.bottom < 12) return 'Use a bottom margin of at least 12 mm for the footer.'
  return null
}
