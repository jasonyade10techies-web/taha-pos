import './lib/uuid';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './styles/globals.css';
import './styles/auth.css';
import './styles/mobile.css';
import './styles/shop-connection.css';
import './styles/device-bridge.css';
import './styles/staff.css';
import {MobileApp} from './app/mobile-app';
import {MobileRoot} from './features/mobile/shop-connection';
import {ErrorBoundary} from './app/error-boundary';
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><MobileRoot><MobileApp/></MobileRoot></ErrorBoundary></StrictMode>);
requestAnimationFrame(()=>{window.__tahaUiReady=true;});

import './styles/product-hardening.css';

import './styles/receipt-print.css';
import './styles/invoice-print.css';
