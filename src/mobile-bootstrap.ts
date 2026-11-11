// Runs before application modules/stores. A startup import error must never leave an empty root.
if (!crypto.randomUUID) Object.defineProperty(crypto,"randomUUID",{value:()=>{
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}});
function startupFailed(){
  const root=document.getElementById("root");if(!root)return;
  root.innerHTML='<main style="padding:32px;font-family:system-ui;color:#202020;background:#f3f3f3;min-height:100vh"><strong style="color:#c62828">TAHA MOBILES</strong><h1>Something went wrong</h1><p>The local app could not start. Your shop address can be changed without reinstalling.</p><button id="boot-reload">Reload App</button> <button id="boot-diagnostics">Diagnostics</button> <button id="boot-reset">Reset Shop Connection</button><p id="boot-details"></p></main>';
  document.getElementById("boot-reload")!.onclick=()=>location.reload();
  document.getElementById("boot-diagnostics")!.onclick=()=>{document.getElementById("boot-details")!.textContent="Local UI startup failed. Build: "+(import.meta.env.VITE_BUNDLED_MOBILE==="true"?"Android 0.4E.0-test":"Browser")+". No credentials are included.";};
  document.getElementById("boot-reset")!.onclick=()=>{localStorage.removeItem("taha-shop-connection");location.hash="/shop-connection";location.reload();};
  window.__tahaUiReady=true;
}
document.getElementById("boot-initial-reload")?.addEventListener("click",()=>location.reload());
window.addEventListener("error",()=>{window.__tahaLastUiError="JavaScript error in the app. Reload App or inspect the TEST build with Android WebView debugging.";if(!window.__tahaUiReady)startupFailed();});
window.addEventListener("unhandledrejection",()=>{window.__tahaLastUiError="An app operation failed unexpectedly. Connection details are available in Diagnostics.";});
void import("./mobile-main").catch(startupFailed);

