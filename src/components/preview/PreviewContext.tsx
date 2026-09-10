import { createContext, useContext } from 'react'
import type { Workspace } from '@/types/filesystem'

interface PreviewContextValue {
  documentPath: string
  workspace: Workspace | null
  navigationWorkspace?: Workspace | null
  onNavigateToDocument?: (path: string) => void
}

const PreviewContext = createContext<PreviewContextValue>({ documentPath: '', workspace: null })

export const PreviewContextProvider = PreviewContext.Provider

export function usePreviewContext(): PreviewContextValue {
  return useContext(PreviewContext)
}

export const LinkedImageContext = createContext(false)
