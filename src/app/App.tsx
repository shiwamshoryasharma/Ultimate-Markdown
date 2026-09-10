import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useThemeSync } from '@/hooks/useThemeSync'

function App() {
  useThemeSync()
  return <RouterProvider router={router} />
}

export default App
