import { useEffect, useState } from "react";
import { Link, useLocation,useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Home, Activity, Smartphone, ScanLine, UserRound, Package, Boxes, BarChart3, X, Search, Settings, LogOut, ChevronRight, ShoppingCart } from "lucide-react";
import { Logo } from "../ui/logo";
import { Dropdown, DropdownItem } from "../ui/dropdown";
import { useSessionStore } from "../../stores/session-store";
import { useMobilePreferences, defaultMobileTabs, type MobileTab } from "../../stores/mobile-preferences-store";
import { permitted } from "../../lib/permissions";
import {useShopConfiguration} from '../../hooks/use-shop-configuration';
const mobileDestinations = {
  Sales:{path:'/mobile/sales',icon:ShoppingCart},
  Home:{path:"/mobile",icon:Home},Activity:{path:"/mobile/activity",icon:Activity},Devices:{path:"/mobile/devices",icon:Smartphone},
  Products:{path:"/mobile/products",icon:Package},Inventory:{path:"/mobile/inventory",icon:Boxes},Reports:{path:"/mobile/reports",icon:BarChart3},Profile:{path:"/profile",icon:UserRound},
};
export function MobileNavigation(){
  const [open,setOpen]=useState(false),[search,setSearch]=useState("");const location=useLocation(),navigate=useNavigate(),session=useSessionStore(),preferences=useMobilePreferences();
  const {configuration}=useShopConfiguration();
  const salesEnabled=configuration?.enabledFeatures.mobileSales===true&&permitted(session.profile,session.permissions,'sales.create');
  const allow=(tab:MobileTab)=>tab==='Sales'?salesEnabled:!['Products','Inventory','Reports'].includes(tab)||permitted(session.profile,session.permissions,tab==='Reports'?'reports.view':'inventory.view');
  const preferred=(session.profile?.role==='owner'?preferences.tabs:defaultMobileTabs).filter(allow);
  const tabs=(salesEnabled&&!preferred.includes('Sales')?[preferred[0]??'Home','Sales',...preferred.slice(2)]:preferred).slice(0,4) as MobileTab[];
  useEffect(()=>{const show=()=>setOpen(true);window.addEventListener('taha-open-mobile-menu',show);return()=>window.removeEventListener('taha-open-mobile-menu',show);},[]);
  const close=()=>{setOpen(false);setSearch("");};
  const active=(path:string)=>path==='/mobile'?location.pathname==='/mobile':path==='/mobile/activity'?location.pathname==='/mobile-camera'||location.pathname.startsWith(path):location.pathname.startsWith(path);
  const tab=(name:MobileTab)=>{const {path,icon:Icon}=mobileDestinations[name];return <Link key={name} to={path} className={active(path)?'active':undefined} aria-current={active(path)?'page':undefined} onClick={close}><span className="mobile-nav-icon"><Icon size={21}/></span><span>{name}</span></Link>;};
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <nav className={`mobile-nav ${preferences.keyboardOpen?'keyboard-hidden':''}`} aria-label="Mobile navigation">{[0,1].map(i=>tabs[i]?tab(tabs[i]):<span key={i} className="mobile-nav-empty"/>)}<button type="button" className="mobile-nav-scan" aria-label="Scan" onClick={()=>{close();window.dispatchEvent(new Event('taha-scan-open'));}}><span className="mobile-nav-icon"><ScanLine size={24}/></span><span>Scan</span></button>{[2,3].map(i=>tabs[i]?tab(tabs[i]):<span key={i} className="mobile-nav-empty"/>)}</nav>
    <Dialog.Portal><Dialog.Overlay className="mobile-drawer-overlay"/><Dialog.Content className="mobile-drawer" aria-describedby="staff-drawer-description"><div className="mobile-drawer-heading"><div><Logo dark/><small>{session.context?.store?.branch_name||'Main Branch'}</small></div><Dialog.Close className="mobile-drawer-close" aria-label="Close navigation"><X size={22}/></Dialog.Close></div><Dialog.Title className="sr-only">Staff navigation</Dialog.Title><Dialog.Description className="sr-only" id="staff-drawer-description">Your mobile tools and account.</Dialog.Description><label className="mobile-menu-search"><Search size={18}/><input aria-label="Find a module" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a tool…"/></label><nav className="mobile-drawer-links" aria-label="Mobile workspace modules">{(Object.keys(mobileDestinations) as MobileTab[]).filter(allow).filter(name=>name.toLowerCase().includes(search.toLowerCase())).map(name=>{const {path,icon:Icon}=mobileDestinations[name];return <Link key={name} to={path} className={active(path)?'active':undefined} onClick={close}><Icon size={20}/><span>{name}</span><ChevronRight size={16}/></Link>;})}{permitted(session.profile,session.permissions,'sales.view')&&<Link to="/mobile/display" onClick={close}><Smartphone size={20}/><span>Customer Display</span></Link>}<Link to="/mobile/settings" onClick={close}><Settings size={20}/><span>Settings</span></Link></nav><div className="mobile-drawer-footer"><span className="avatar">{session.employee.initials}</span><div><strong>{session.employee.name}</strong><span>{session.employee.role}</span></div><Dropdown trigger={<button className="mobile-drawer-account-menu" aria-label="Account menu"><Settings size={20}/></button>}><DropdownItem onSelect={()=>{close();navigate('/profile');}}>Profile</DropdownItem><DropdownItem onSelect={()=>{close();window.dispatchEvent(new Event('taha-mobile-logout'));}}><LogOut size={16}/> Sign Out</DropdownItem></Dropdown></div></Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

