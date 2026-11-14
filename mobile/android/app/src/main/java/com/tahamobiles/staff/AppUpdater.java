package com.tahamobiles.staff;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.AtomicFile;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import java.lang.ref.WeakReference;
import java.net.URI;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.BooleanSupplier;
import javax.net.ssl.HttpsURLConnection;

/** Bounded anonymous update transport. Only the user's install action opens Android UI. */
final class AppUpdater implements AutoCloseable {
    private final Context context;
    private final WeakReference<Activity> activity;
    private final WeakReference<WebView> web;
    private BooleanSupplier safeToInstall;
    private final SharedPreferences preferences;
    private final File directory;
    private final AtomicFile saved;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final UpdatePolicy.Operations operations=new UpdatePolicy.Operations();
    private volatile HttpsURLConnection connection;
    private volatile boolean closed;
    private String explicitOrigin,origin,state="not-configured",error;
    private String currentVersionName="",applicationId,certificate="";
    private long currentVersionCode,bytesDownloaded,totalBytes;
    private int backendApiVersion;
    private UpdatePolicy.Release latest,verifiedRelease;
    private File verifiedFile;
    private final String channel;

    AppUpdater(Activity activity,WebView web,BooleanSupplier safeToInstall) {
        this.context=activity.getApplicationContext();this.activity=new WeakReference<>(activity);this.web=new WeakReference<>(web);this.safeToInstall=safeToInstall;
        applicationId=context.getPackageName();channel=BuildConfig.DEBUG?"test":"stable";
        preferences=context.getSharedPreferences("taha-app-updates",Context.MODE_PRIVATE);
        explicitOrigin=UpdatePolicy.origin(preferences.getString("origin",null));origin=explicitOrigin;
        directory=new File(context.getFilesDir(),"app-updates");saved=new AtomicFile(new File(directory,"verified.json"));
        try{refreshInstalled();state=origin==null?"not-configured":"idle";}catch(Exception invalid){state="error";error="INSTALLED_IDENTITY_UNAVAILABLE";}
        if(origin!=null)restore(origin);
    }

    synchronized String configuredOrigin(){return explicitOrigin;}
    synchronized boolean configureOrigin(String value) {
        if(closed)return false;
        String selected=value==null||value.trim().isEmpty()?null:UpdatePolicy.origin(value);
        stopWork();clearSelection();explicitOrigin=selected;origin=selected;
        // Invalid input clears an old origin rather than silently checking the wrong shop.
        boolean persisted=preferences.edit().remove("origin").commit();
        if(selected!=null)persisted=preferences.edit().putString("origin",selected).commit();
        if(!persisted){explicitOrigin=null;origin=null;transition("error","ORIGIN_STORAGE_FAILED");return false;}
        transition(origin==null?"not-configured":"idle",selected==null&&value!=null&&!value.trim().isEmpty()?"INVALID_ORIGIN":null);
        if(selected!=null)restore(selected);
        return selected!=null||value==null||value.trim().isEmpty();
    }

    synchronized void check(String selectedShopOrigin,int backendApiVersion) {
        if(closed)return;
        String selected=explicitOrigin!=null?explicitOrigin:UpdatePolicy.origin(selectedShopOrigin);
        if(selected==null){stopWork();clearSelection();origin=null;transition("not-configured",null);return;}
        if(backendApiVersion<1){stopWork();clearSelection();origin=selected;transition("incompatible","BACKEND_API_UNAVAILABLE");return;}
        if(!selected.equals(origin)){stopWork();clearSelection();origin=selected;}
        long token=operations.begin();if(token==0)return;
        this.backendApiVersion=backendApiVersion;latest=null;bytesDownloaded=0;totalBytes=0;transition("checking",null);
        submit(token,()->{
            byte[] bytes=requestManifest(selected,token);
            UpdatePolicy.Release release=UpdatePolicy.parse(bytes,selected,channel);
            synchronized(this){if(!operations.active(token))return;refreshInstalled();latest=release;
                String compatibility=UpdatePolicy.compatibility(release,applicationId,currentVersionCode,installedSigners(),Build.VERSION.SDK_INT,backendApiVersion);
                if("available".equals(compatibility)&&verifiedFile!=null&&verifiedRelease!=null&&verifiedRelease.sha256.equals(release.sha256)&&verifiedRelease.versionCode==release.versionCode)compatibility="downloaded";
                transition(compatibility,"incompatible".equals(compatibility)?"UPDATE_INCOMPATIBLE":null);
            }
        });
    }

    synchronized void download() {
        if(closed||origin==null||latest==null)return;
        UpdatePolicy.Release release=latest;String selected=origin;int backend=backendApiVersion;
        try {refreshInstalled();if(!"available".equals(UpdatePolicy.compatibility(release,applicationId,currentVersionCode,installedSigners(),Build.VERSION.SDK_INT,backend))){transition("incompatible","UPDATE_INCOMPATIBLE");return;}}
        catch(Exception invalid){transition("error","INSTALLED_IDENTITY_UNAVAILABLE");return;}
        long token=operations.begin();if(token==0)return;
        bytesDownloaded=0;totalBytes=release.sizeBytes;transition("downloading",null);
        submit(token,()->{
            if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("UPDATE_STORAGE_FAILED");
            File partial=new File(directory,"pending-"+token+"-"+System.nanoTime()+".part");
            try {
                HttpsURLConnection request=open(selected,release.apk,token,120000);
                try(InputStream input=request.getInputStream()){
                    long length=request.getContentLengthLong();if(length>=0&&length!=release.sizeBytes)throw new IOException("APK_SIZE_MISMATCH");
                    final long[] lastProgress={0};final long deadline=System.nanoTime()+120000000000L;
                    UpdatePolicy.copyVerified(input,partial,release,()->!operations.active(token)||System.nanoTime()>deadline,(done,total)->{
                        synchronized(this){if(!operations.active(token))return;bytesDownloaded=done;totalBytes=total;
                            if(done==total||System.nanoTime()-lastProgress[0]>=250000000L){lastProgress[0]=System.nanoTime();emit();}}
                    });
                }finally{disconnect(request);}
                validateArchive(partial,release,backend);
                synchronized(this){if(!operations.active(token))return;
                    File target=new File(directory,release.versionCode+"-"+release.sha256+".apk");
                    if(target.exists()){UpdatePolicy.verifyFile(target,release);if(!partial.delete())throw new IOException("UPDATE_STORAGE_FAILED");}
                    else if(!partial.renameTo(target))throw new IOException("UPDATE_STORAGE_FAILED");
                    // Metadata is atomic and committed only after the complete APK passes every check.
                    persist(selected,release,backend);
                    verifiedFile=target;verifiedRelease=release;bytesDownloaded=release.sizeBytes;totalBytes=release.sizeBytes;
                    transition("downloaded",null);removeSuperseded(target);
                }
            }finally{if(partial.exists())partial.delete();}
        });
    }

    synchronized void install() {
        if(closed)return;
        if(verifiedFile==null||verifiedRelease==null){transition("error","NO_VERIFIED_DOWNLOAD");return;}
        long token=operations.begin();if(token==0)return;
        File file=verifiedFile;UpdatePolicy.Release release=verifiedRelease;int backend=backendApiVersion;
        submit(token,()->{
            UpdatePolicy.verifyFile(file,release);validateArchive(file,release,backend);
            Activity owner=activity.get();if(owner==null)throw new IOException("ACTIVITY_UNAVAILABLE");
            // The job remains active until the UI handoff. No duplicate installer launches.
            owner.runOnUiThread(()->{
                synchronized(this){
                    if(!operations.active(token)||closed)return;
                    try {
                        Activity current=activity.get();
                        if(current==null||current.isFinishing()||current.isDestroyed())throw new IOException("ACTIVITY_UNAVAILABLE");
                        if(safeToInstall==null||!safeToInstall.getAsBoolean()){transition("downloaded","INSTALL_BUSY");return;}
                        // Re-read installed identity immediately before handing the URI to Android.
                        validateArchive(file,release,backend);
                        if(!context.getPackageManager().canRequestPackageInstalls()) {
                            transition("permission-required",null);
                            current.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+applicationId)));
                            return; // The user must press Install again after granting permission.
                        }
                        Uri uri=FileProvider.getUriForFile(current,applicationId+".updates",file);
                        Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);intent.setClipData(ClipData.newRawUri("Taha app update",uri));
                        current.startActivity(intent);transition("installer-opened",null);
                    }catch(Exception failed){transition("error",sanitized(failed));}
                    finally{operations.finish(token);}
                }
            });
        },false);
    }

    synchronized void cancel(){if(closed)return;stopWork();transition("cancelled",null);}
    synchronized String status() {
        JSONObject result=new JSONObject();
        try {
            result.put("state",state).put("currentVersionName",currentVersionName).put("currentVersionCode",currentVersionCode)
                .put("applicationId",applicationId).put("signingCertificateSha256",certificate).put("apiVersion",1);
            if(explicitOrigin!=null)result.put("configuredOrigin",explicitOrigin);
            if(origin!=null)result.put("origin",origin);
            if(latest!=null)result.put("latest",new JSONObject(latest.json));
            if(totalBytes>0)result.put("bytesDownloaded",bytesDownloaded).put("totalBytes",totalBytes);
            if(error!=null)result.put("error",error);
        }catch(Exception ignored){}
        return result.toString();
    }
    @Override public synchronized void close() {
        if(closed)return;closed=true;stopWork();operations.close();worker.shutdownNow();safeToInstall=null;activity.clear();web.clear();
    }

    private synchronized void restore(String selected) {
        long token=operations.begin();if(token==0)return;
        submit(token,()->{
            if(!saved.getBaseFile().exists())return;
            JSONObject record;
            try(InputStream input=saved.openRead()){record=new JSONObject(new String(readBounded(input,UpdatePolicy.MANIFEST_LIMIT+4096,token,10000),StandardCharsets.UTF_8));}
            if(!selected.equals(record.getString("origin")))return;
            int backend=record.getInt("backendApiVersion");if(backend<1)return;
            UpdatePolicy.Release release=UpdatePolicy.parse(record.getJSONObject("manifest").toString().getBytes(StandardCharsets.UTF_8),selected,channel);
            File target=new File(directory,release.versionCode+"-"+release.sha256+".apk");
            // A successful Android installation leaves the old download record behind.
            // It is no longer an install candidate; do not call it a corrupt/incompatible update.
            refreshInstalled();
            if("current".equals(UpdatePolicy.compatibility(release,applicationId,currentVersionCode,installedSigners(),Build.VERSION.SDK_INT,backend))){
                synchronized(this){if(!operations.active(token))return;saved.delete();verifiedFile=null;verifiedRelease=null;latest=null;transition("idle",null);}return;
            }
            UpdatePolicy.verifyFile(target,release);validateArchive(target,release,backend);
            synchronized(this){if(!operations.active(token))return;verifiedFile=target;verifiedRelease=release;latest=release;backendApiVersion=backend;bytesDownloaded=release.sizeBytes;totalBytes=release.sizeBytes;transition("downloaded",null);}
        });
    }
    private void persist(String selected,UpdatePolicy.Release release,int backend)throws Exception {
        JSONObject record=new JSONObject().put("origin",selected).put("backendApiVersion",backend).put("manifest",new JSONObject(release.json));
        FileOutputStream output=null;
        try{output=saved.startWrite();output.write(record.toString().getBytes(StandardCharsets.UTF_8));saved.finishWrite(output);}
        catch(Exception failed){if(output!=null)saved.failWrite(output);throw new IOException("UPDATE_STORAGE_FAILED");}
    }
    private void removeSuperseded(File retained) {
        File[] files=directory.listFiles();if(files==null)return;
        for(File old:files)if(!old.equals(retained)&&old.isFile()&&old.getName().matches("[0-9]+-[a-f0-9]{64}\\.apk"))old.delete();
    }
    private byte[] requestManifest(String selected,long token)throws Exception {
        HttpsURLConnection request=open(selected,new URI(selected+"/downloads/taha-staff/releases/"+channel+".json"),token,30000);
        try(InputStream input=request.getInputStream()){
            if(request.getContentLengthLong()>UpdatePolicy.MANIFEST_LIMIT)throw new IOException("MANIFEST_TOO_LARGE");
            return readBounded(input,UpdatePolicy.MANIFEST_LIMIT,token,30000);
        }finally{disconnect(request);}
    }
    private HttpsURLConnection open(String selected,URI url,long token,int deadlineMillis)throws Exception {
        long deadline=System.nanoTime()+deadlineMillis*1000000L;
        for(int redirects=0;;redirects++) {
            if(!operations.active(token))throw new InterruptedIOException("CANCELLED");
            if(System.nanoTime()>deadline)throw new SocketTimeoutException();
            HttpsURLConnection request=(HttpsURLConnection)url.toURL().openConnection();
            synchronized(this){if(!operations.active(token)){request.disconnect();throw new InterruptedIOException("CANCELLED");}connection=request;}
            request.setInstanceFollowRedirects(false);request.setConnectTimeout(10000);request.setReadTimeout(15000);request.setUseCaches(false);request.setRequestMethod("GET");
            request.setRequestProperty("Accept-Encoding","identity");request.setRequestProperty("Accept","application/json, application/vnd.android.package-archive, application/octet-stream");
            // WebView authentication is deliberately never consulted or copied.
            request.setRequestProperty("Cookie","");request.setRequestProperty("Authorization","");
            try {
                int response=request.getResponseCode();
                if(response==301||response==302||response==303||response==307||response==308) {
                    URI next=UpdatePolicy.redirect(selected,url,request.getHeaderField("Location"),redirects);disconnect(request);url=next;continue;
                }
                if(response!=200)throw new IOException(response==404?"RELEASE_UNAVAILABLE":"UPDATE_HTTP_ERROR");
                String encoding=request.getContentEncoding();if(encoding!=null&&!encoding.equalsIgnoreCase("identity"))throw new IOException("UNSUPPORTED_CONTENT_ENCODING");
                if(!operations.active(token))throw new InterruptedIOException("CANCELLED");return request;
            }catch(Exception failed){disconnect(request);throw failed;}
        }
    }
    private byte[] readBounded(InputStream input,int maximum,long token,int timeoutMillis)throws Exception {
        ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[4096];long deadline=System.nanoTime()+timeoutMillis*1000000L;
        while(true){if(!operations.active(token))throw new InterruptedIOException("CANCELLED");if(System.nanoTime()>deadline)throw new SocketTimeoutException();
            int read=input.read(buffer);if(read==-1)break;if(output.size()+read>maximum)throw new IOException("MANIFEST_TOO_LARGE");output.write(buffer,0,read);}
        return output.toByteArray();
    }
    private synchronized void disconnect(HttpsURLConnection request){request.disconnect();if(connection==request)connection=null;}
    private void refreshInstalled()throws Exception {
        PackageInfo info=installed();Set<String> signers=signers(info);
        if(signers.isEmpty())throw new SecurityException("INSTALLED_IDENTITY_UNAVAILABLE");
        applicationId=info.packageName;currentVersionName=info.versionName;currentVersionCode=version(info);
        // The contract's single fingerprint is deterministic; archive validation checks the full signer set.
        certificate=java.util.Collections.min(signers);
    }
    private PackageInfo installed()throws Exception{return context.getPackageManager().getPackageInfo(context.getPackageName(),signatureFlags());}
    private Set<String> installedSigners()throws Exception{return signers(installed());}
    private static int signatureFlags(){return Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;}
    @SuppressWarnings("deprecation") private static long version(PackageInfo info){return Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode;}
    @SuppressWarnings("deprecation") private static Set<String> signers(PackageInfo info)throws Exception {
        Signature[] signatures=Build.VERSION.SDK_INT>=28?(info.signingInfo==null?null:info.signingInfo.getApkContentsSigners()):info.signatures;
        Set<String> result=new HashSet<>();if(signatures==null||signatures.length==0)throw new SecurityException("APK_IDENTITY_MISMATCH");
        for(Signature signature:signatures)result.add(UpdatePolicy.hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        return result;
    }
    private void validateArchive(File file,UpdatePolicy.Release release,int backend)throws Exception {
        PackageInfo current=installed(),archive=context.getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(),signatureFlags());
        if(archive==null||archive.applicationInfo==null)throw new SecurityException("APK_IDENTITY_MISMATCH");
        Set<String> installedSigners=signers(current);
        if(!"available".equals(UpdatePolicy.compatibility(release,current.packageName,version(current),installedSigners,Build.VERSION.SDK_INT,backend))||archive.applicationInfo.minSdkVersion>Build.VERSION.SDK_INT)throw new SecurityException("UPDATE_INCOMPATIBLE");
        UpdatePolicy.validateArchive(release,archive.packageName,version(archive),signers(archive),current.packageName,version(current),installedSigners);
    }
    private interface Work {void run()throws Exception;}
    private void submit(long token,Work work){submit(token,work,true);}
    private void submit(long token,Work work,boolean finish) {
        try{worker.execute(()->{try{if(operations.active(token))work.run();}
            catch(Exception failed){synchronized(this){if(operations.active(token)){transition("error",sanitized(failed));operations.finish(token);}}}
            finally{if(finish)operations.finish(token);}});}
        catch(RejectedExecutionException stopped){operations.finish(token);}
    }
    private void stopWork(){operations.cancel();HttpsURLConnection request=connection;if(request!=null){connection=null;request.disconnect();}}
    private void clearSelection(){latest=null;verifiedRelease=null;verifiedFile=null;bytesDownloaded=0;totalBytes=0;backendApiVersion=0;}
    private void transition(String next,String failure){state=next;error=failure;emit();}
    private void emit() {
        if(closed)return;String json=status();Activity owner=activity.get();if(owner==null)return;
        owner.runOnUiThread(()->{WebView view=web.get();if(!closed&&view!=null)view.evaluateJavascript("window.dispatchEvent(new CustomEvent('taha-app-update',{detail:"+json+"}))",null);});
    }
    private static String sanitized(Exception failure) {
        if(failure instanceof SocketTimeoutException)return "UPDATE_TIMEOUT";
        if(failure instanceof InterruptedIOException)return "UPDATE_CANCELLED";
        String code=failure.getMessage();
        if(code!=null&&code.matches("(INVALID_MANIFEST|UNSAFE_REDIRECT|APK_SIZE_MISMATCH|APK_HASH_MISMATCH|APK_IDENTITY_MISMATCH|UPDATE_INCOMPATIBLE|UPDATE_STORAGE_FAILED|MANIFEST_TOO_LARGE|RELEASE_UNAVAILABLE|UPDATE_HTTP_ERROR|UNSUPPORTED_CONTENT_ENCODING|ACTIVITY_UNAVAILABLE|INSTALLED_IDENTITY_UNAVAILABLE)"))return code;
        if(failure instanceof android.content.ActivityNotFoundException)return "INSTALLER_UNAVAILABLE";
        if(failure instanceof SecurityException)return "UPDATE_BLOCKED";
        return "UPDATE_UNAVAILABLE";
    }
}
