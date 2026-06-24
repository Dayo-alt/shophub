import React from 'react'
import ReactDOM from 'react-dom/client'
import '../styles/globals.css'
import App from '../App'
import { LanguageProvider } from '../utils/i18n/LanguageContext'
import { Toaster } from '../components/ui/sonner'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
      <Toaster position="bottom-right" richColors duration={3000} />
    </LanguageProvider>
  </React.StrictMode>,
)
