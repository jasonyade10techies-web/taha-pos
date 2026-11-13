import type {ReactNode} from 'react';
import {Link,Navigate,useLocation,useNavigate} from 'react-router-dom';
import {useSessionStore} from '../../stores/session-store';
import {apiEnabled} from '../../lib/config';
import {repositories} from '../../lib/repositories';
import {useRepository} from '../../hooks/use-repository';
import {Button} from '../../components/ui/button';
import {ShopSetup} from './shop-setup';
import {TaxSettings} from './tax-settings';

export function ShopSetupGate({children}:{children:ReactNode}){
 const profile=useSessionStore(state=>state.profile),location=useLocation(),enabled=apiEnabled&&profile?.role==='owner';
 const query=useRepository('settings',()=>repositories.settings.get(),enabled);
 if(!enabled)return <>{children}</>;
 if(query.isPending)return <p role="status">Checking shop setup…</p>;
 if(query.isError)return <section className="panel"><p role="alert">Shop settings are unavailable. Check the connection and retry.</p><Button onClick={()=>void query.refetch()}>Retry</Button></section>;
 const config=query.data?.shopConfiguration;
 if(!config?.setupRequired||config.setupCompleted)return <>{children}</>;
 const allowed=['/setup','/setup/tax','/locations','/payment-methods','/mobile/devices','/mobile/display'].includes(location.pathname)||
  (location.pathname==='/settings'&&['Tax','Devices','Customer Display'].includes(new URLSearchParams(location.search).get('section')??''));
 if(!allowed)return <Navigate to="/setup" replace/>;
 return <>{location.pathname!=='/setup'&&<p className="setup-intro" role="status">Shop setup is in progress. <Link className="text-link" to="/setup">Continue Shop Setup</Link></p>}{children}</>;
}

export function FirstRunSetupPage({mobile=false}:{mobile?:boolean}){
 const profile=useSessionStore(state=>state.profile),query=useRepository('settings',()=>repositories.settings.get(),profile?.role==='owner'),navigate=useNavigate();
 if(profile?.role!=='owner')return <section className="panel"><h1>Owner access required</h1><p>The shop owner completes initial setup.</p></section>;
 if(query.isPending)return <p role="status">Opening Shop Setup…</p>;
 if(query.isError)return <section className="panel"><p role="alert">Cannot load Shop Setup.</p><Button onClick={()=>void query.refetch()}>Retry</Button></section>;
 if(query.data?.shopConfiguration?.setupCompleted)return <Navigate to={mobile?'/mobile':'/dashboard'} replace/>;
 return <section className="panel first-run-setup"><h1>Set up Taha Mobiles</h1><p className="setup-intro">Choose what your shop needs. Optional devices and modules can be configured later.</p><ShopSetup settings={query.data!} firstRun mobile={mobile} onComplete={()=>navigate(mobile?'/mobile':'/dashboard',{replace:true})}/></section>;
}

export function FirstRunTaxPage(){
 const profile=useSessionStore(state=>state.profile),query=useRepository('settings',()=>repositories.settings.get(),profile?.role==='owner');
 if(profile?.role!=='owner')return <p role="alert">Only the owner can configure shop tax.</p>;
 if(query.isPending)return <p role="status">Loading tax settings…</p>;
 if(query.isError)return <p role="alert">Tax settings are unavailable. Return to Shop Setup and retry.</p>;
 return <section className="panel first-run-setup"><h1>Tax settings</h1><TaxSettings key={JSON.stringify(query.data?.taxProfiles)} settings={query.data!}/><Link className="text-link" to="/setup">Return to Shop Setup</Link></section>;
}
