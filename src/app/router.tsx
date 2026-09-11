import { createBrowserRouter, createHashRouter } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { WorkspacePage } from '@/pages/WorkspacePage'
import { ConverterPage } from '@/pages/ConverterPage'
import { SettingsPage } from '@/pages/SettingsPage'

// Hash routes let static hosts refresh pages without server-side rewrites.
const createRouter = import.meta.env.PROD ? createHashRouter : createBrowserRouter
export const router = createRouter([
  { path: '/', element: <HomePage /> },
  { path: '/workspace', element: <WorkspacePage /> },
  { path: '/converter', element: <ConverterPage /> },
  { path: '/import', hydrateFallbackElement: <p role="status">Opening import…</p>, lazy: async () => ({ Component: (await import('@/pages/ImportPage')).ImportPage }) },
  { path: '/settings', element: <SettingsPage /> },
])
