import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installMobileApiRuntime } from './app/mobileApi'
import { App } from './app/App'
import './app/global.css'

installMobileApiRuntime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
