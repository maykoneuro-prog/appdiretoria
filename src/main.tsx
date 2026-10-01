import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ignora erros injetados por extensões de navegador (ex: MetaMask)
window.addEventListener(
  'unhandledrejection',
  (event) => {
    const msg = String(event.reason?.message || event.reason || '');
    const stack = String(event.reason?.stack || '');
    if (
      msg.includes('MetaMask') ||
      stack.includes('chrome-extension://') ||
      stack.includes('inpage.js')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
