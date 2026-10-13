import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isAndroidApp } from './lib/nativeLayout';

document.documentElement.classList.toggle('android-app', isAndroidApp);
document.documentElement.classList.toggle('compact-layout', isAndroidApp || window.matchMedia('(max-width: 767px)').matches);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
