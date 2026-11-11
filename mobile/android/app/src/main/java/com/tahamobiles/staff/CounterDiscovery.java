package com.tahamobiles.staff;

import android.app.Activity;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import org.json.JSONObject;
import java.util.ArrayDeque;
import java.util.HashSet;

/** Reachability hints only. Trust still comes from the PC QR + owner approval. */
@SuppressWarnings("deprecation")
final class CounterDiscovery {
    private final NsdManager manager;
    private final WebView web;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ArrayDeque<NsdServiceInfo> queue=new ArrayDeque<>();
    private final HashSet<String> found=new HashSet<>();
    private NsdManager.DiscoveryListener listener;
    private boolean resolving;
    private int generation;
    CounterDiscovery(Activity activity,WebView web){this.web=web;manager=(NsdManager)activity.getSystemService(Activity.NSD_SERVICE);}
    void start(){stop();final int run=++generation;found.clear();queue.clear();resolving=false;
        listener=new NsdManager.DiscoveryListener(){
            public void onDiscoveryStarted(String type){emit("searching",null,null);}
            public void onServiceFound(NsdServiceInfo service){main.post(()->{if(run!=generation||found.size()>=20||!service.getServiceType().contains("_taha-pos._tcp"))return;if(found.add(service.getServiceName())){queue.add(service);resolveNext(run);}});}
            public void onServiceLost(NsdServiceInfo service){emit("lost",service.getServiceName(),null);}
            public void onDiscoveryStopped(String type){}
            public void onStartDiscoveryFailed(String type,int code){main.post(()->{if(run==generation){emit("blocked",null,null);stop();}});}
            public void onStopDiscoveryFailed(String type,int code){}
        };
        try{manager.discoverServices("_taha-pos._tcp.",NsdManager.PROTOCOL_DNS_SD,listener);main.postDelayed(()->{if(run==generation){emit("finished",null,null);stop();}},10000);}catch(Exception error){emit("blocked",null,null);stop();}
    }
    private void resolveNext(int run){if(resolving||queue.isEmpty()||run!=generation)return;resolving=true;NsdServiceInfo candidate=queue.remove();
        try{manager.resolveService(candidate,new NsdManager.ResolveListener(){
            public void onResolveFailed(NsdServiceInfo service,int code){main.post(()->{if(run==generation){resolving=false;resolveNext(run);}});}
            public void onServiceResolved(NsdServiceInfo service){main.post(()->{if(run!=generation)return;resolving=false;String host=service.getHost()==null?"":service.getHost().getHostAddress();int port=service.getPort();if(host!=null&&host.matches("[0-9.]+")&&port>0&&port<=65535)emit("found",service.getServiceName(),"https://"+host+":"+port);resolveNext(run);});}
        });}catch(Exception ignored){resolving=false;resolveNext(run);}
    }
    void stop(){++generation;queue.clear();resolving=false;NsdManager.DiscoveryListener prior=listener;listener=null;if(prior!=null)try{manager.stopServiceDiscovery(prior);}catch(Exception ignored){}}
    private void emit(String status,String name,String address){try{JSONObject result=new JSONObject().put("status",status);if(name!=null)result.put("name",name.substring(0,Math.min(120,name.length())));if(address!=null)result.put("address",address);String js="window.dispatchEvent(new CustomEvent('taha-counter-discovery',{detail:"+result+"}));";main.post(()->web.evaluateJavascript(js,null));}catch(Exception ignored){}}
}
