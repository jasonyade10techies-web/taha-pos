import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MediaImage} from '../../src/components/media/media-image';
import {useSessionStore,mockContext} from '../../src/stores/session-store';
import {useDeviceBridgeStore} from '../../src/stores/device-bridge-store';
export function renderAuthenticatedPrivateImage(){
 useSessionStore.getState().applyContext(mockContext);
 useDeviceBridgeStore.setState({auth:'signed-out',context:null});
 useDeviceBridgeStore.subscribe(state=>{if(state.auth!=='signed-out'||state.context!==null)useDeviceBridgeStore.setState({auth:'signed-out',context:null});});
 const host=document.createElement('div');host.id='private-image-regression';host.style.cssText='position:fixed;top:0;left:0;width:40px;height:40px;z-index:9999;pointer-events:none';document.body.append(host);
 createRoot(host).render(createElement(QueryClientProvider,{client:new QueryClient()},createElement(MediaImage,{src:'taha-media:private/product/regression.png',alt:'Authenticated private product'})));
}
