/**
 * Application Entry Point
 * 
 * Main entry file that initializes the React application.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import { applyTheme, readTheme } from './utils/theme'
import App from './App.tsx'

applyTheme(readTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
