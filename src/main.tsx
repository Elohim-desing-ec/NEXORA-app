import React from 'react'
import ReactDOM from 'react-dom/client'
import 'katex/dist/katex.min.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App'

// App instalable (PWA): solo en la versión publicada, para que en desarrollo no se guarden copias viejas
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined))

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
