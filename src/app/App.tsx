import { useEffect } from 'react'
import { useImportStore } from '@/stores/importStore'
import { useDocumentStore } from '@/stores/documentStore'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useThemeSync } from '@/hooks/useThemeSync'
import { ConfirmationProvider } from '@/components/common/ConfirmationProvider'

function App() {
  useThemeSync()
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(useImportStore.getState().session||useDocumentStore.getState().hasAnyUnsaved()){event.preventDefault();event.returnValue=''}}
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)
  },[])
  return <ConfirmationProvider><RouterProvider router={router} /></ConfirmationProvider>
}

export default App
