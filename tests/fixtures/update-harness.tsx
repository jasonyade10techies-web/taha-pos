import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppUpdatesPage} from '../../src/features/mobile/app-updates-page';
import {AndroidDownloads} from '../../src/components/devices/android-downloads';
import {useSessionStore} from '../../src/stores/session-store';
export function mount(mode:'updates'|'downloads'|'updates-without-router'){
 const node=document.createElement('section');node.id='update-test-harness';document.body.replaceChildren(node);
 createRoot(node).render(mode==='updates-without-router'?<AppUpdatesPage/>:<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter>{mode==='updates'?<AppUpdatesPage/>:<AndroidDownloads/>}</BrowserRouter></QueryClientProvider>);
}
export function checkout(open:boolean){useSessionStore.setState({checkoutOpen:open});}
