import React from 'react'
import ReactDOM from 'react-dom/client'
import '../styles/globals.css'
import App from '../App'
import { LanguageProvider } from '../utils/i18n/LanguageContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
)
