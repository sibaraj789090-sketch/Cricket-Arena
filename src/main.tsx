import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline caching & PWA compliance
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Cricket Arena PWA: New update available.');
  },
  onOfflineReady() {
    console.log('Cricket Arena PWA: App ready for offline usage.');
  },
});

createRoot(document.getElementById('root')!).render(<App />);
