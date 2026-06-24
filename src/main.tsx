import * as Sentry from "@sentry/react";
import React from 'react'
import ReactDOM from 'react-dom/client'
import '../styles/globals.css'
import App from '../App'
import { LanguageProvider } from '../utils/i18n/LanguageContext'
import { Toaster } from '../components/ui/sonner'

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://37e23b2c3642a4dad6fe38b4c668a3bd@o4511622523453440.ingest.us.sentry.io/4511622552879104",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
      <Toaster position="bottom-right" richColors duration={3000} />
    </LanguageProvider>
  </React.StrictMode>,
)
