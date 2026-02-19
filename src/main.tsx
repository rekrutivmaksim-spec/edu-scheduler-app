import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initMobileOptimizations } from './lib/mobile-utils'

// Инициализируем мобильные оптимизации
initMobileOptimizations();

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}