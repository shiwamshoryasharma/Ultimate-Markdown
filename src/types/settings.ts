export type ThemeMode = 'system' | 'light' | 'dark'

export type CodeTheme = 'auto' | 'light' | 'dark'

export type PaperSize = 'a4' | 'letter'

export interface EditorSettings {
  fontSize: number
  lineHeight: number
  wordWrap: boolean
  tabSize: number
  showLineNumbers: boolean
}

export interface PreviewSettings {
  fontSize: number
  contentWidth: 'narrow' | 'comfortable' | 'wide' | 'full'
  codeTheme: CodeTheme
  showToc: boolean
}

export interface ExportSettings {
  paperSize: PaperSize
  marginMm: number
  documentTitle: string
  showPageNumbers: boolean
}

export interface AppSettings {
  theme: ThemeMode
  editor: EditorSettings
  preview: PreviewSettings
  export: ExportSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  editor: {
    fontSize: 15,
    lineHeight: 1.6,
    wordWrap: true,
    tabSize: 2,
    showLineNumbers: true,
  },
  preview: {
    fontSize: 16,
    contentWidth: 'comfortable',
    codeTheme: 'auto',
    showToc: true,
  },
  export: {
    paperSize: 'a4',
    marginMm: 20,
    documentTitle: '',
    showPageNumbers: true,
  },
}
