import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMetaPixel } from './metaPixel'

// Meta (Facebook) Pixel — fires PageView once configured via VITE_META_PIXEL_ID.
initMetaPixel()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
