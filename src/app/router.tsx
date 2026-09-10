import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { WorkspacePage } from '@/pages/WorkspacePage'
import { ConverterPage } from '@/pages/ConverterPage'
import { SettingsPage } from '@/pages/SettingsPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/workspace', element: <WorkspacePage /> },
  { path: '/converter', element: <ConverterPage /> },
  { path: '/settings', element: <SettingsPage /> },
])
