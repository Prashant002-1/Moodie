/**
 * Application Entry Point
 * 
 * Main entry file that initializes the React application.
 * Sets up the React root with StrictMode and renders the App component.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
