package com.tahamobiles.staff;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.*;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/** Bundled React UI: the shop URL is a backend connection, never a navigation destination. */
public class MainActivity extends ComponentActivity {
    private static final int PHOTO_REQUEST=104;
    private static final int PHOTO_PERMISSION=105,SCAN_PERMISSION=106;
    private File lastCameraFile;
    private boolean scanOpen;
    private final ActivityResultLauncher<ScanOptions> scanLauncher=registerForActivityResult(new ScanContract(),result->{scanOpen=false;Intent intent=result.getOriginalIntent();emitScan(result.getContents(),intent==null?null:intent.getStringExtra(ScannerActivity.EXTRA_ERROR),intent==null?null:intent.getStringExtra(ScannerActivity.EXTRA_MODE),result.getFormatName());});
    void scanQr(){if(scanOpen)return;if(checkSelfPermission(android.Manifest.permission.CAMERA)!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.CAMERA},SCAN_PERMISSION);return;}ScanOptions options=new ScanOptions();options.setCaptureActivity(ScannerActivity.class);options.setDesiredBarcodeFormats(ScanOptions.ALL_CODE_TYPES);options.setOrientationLocked(false);options.setBeepEnabled(false);try{scanOpen=true;scanLauncher.launch(options);}catch(Exception error){scanOpen=false;emitScan(null,"CAMERA_UNAVAILABLE","qr",null);}}
    private void emitScan(String value,String error,String mode,String format){try{JSONObject detail=new JSONObject();if(value!=null)detail.put("value",value);if(error!=null)detail.put("error",error);if(mode!=null)detail.put("mode",mode);if(format!=null)detail.put("format",format);if(web!=null)web.evaluateJavascript("window.dispatchEvent(new CustomEvent('taha-scan-result',{detail:"+detail+"}))",null);}catch(Exception ignored){}}
    void clearCaptureOriginal(){if(lastCameraFile!=null){bridge.acknowledgeOriginal(lastCameraFile);lastCameraFile=null;}}
    private LinearLayout root;
    private WebView web;
    private ShopBridge bridge;
    private ValueCallback<Uri[]> fileCallback;
    private File cameraFile;
    private Uri cameraUri;
    private boolean multipleFiles;
    private JSONObject pendingPair;
    private android.net.ConnectivityManager networkManager;
    private android.net.ConnectivityManager.NetworkCallback networkCallback;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(243,243,243));
        root.setOnApplyWindowInsetsListener((v,insets)->{
            if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());android.graphics.Insets keyboard=insets.getInsets(WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,keyboard.bottom));}
            else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;
        });setContentView(root);readPairIntent(getIntent());openLocal();
        networkManager=(android.net.ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
        networkCallback=new android.net.ConnectivityManager.NetworkCallback(){@Override public void onAvailable(android.net.Network network){emitNetwork("online");}@Override public void onLost(android.net.Network network){emitNetwork("offline");}};
        networkManager.registerDefaultNetworkCallback(networkCallback);
    }
    private void emitNetwork(String event){runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('"+event+"'))",null);});}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readPairIntent(intent);deliverPair();}
    private void readPairIntent(Intent intent){
        Uri data=intent.getData();if(data==null||!"taha-mobile".equals(data.getScheme()))return;
        if("camera".equals(data.getHost())||"enroll".equals(data.getHost())){try{pendingPair=new JSONObject();pendingPair.put("qrValue",data.toString());}catch(Exception ignored){}return;}
        if(!"pair".equals(data.getHost()))return;
        try{String shop=data.getQueryParameter("shop"),terminal=data.getQueryParameter("terminal"),code=data.getQueryParameter("code");
            String origin=OriginPolicy.origin(shop==null?"":shop,BuildConfig.DEBUG);
            if(origin==null||terminal==null||terminal.length()>128||code==null||!code.matches("([0-9]{6}|[A-Za-z0-9]{8})"))return;
            pendingPair=new JSONObject();pendingPair.put("shopAddress",origin);pendingPair.put("terminalId",terminal);pendingPair.put("code",code.toUpperCase(java.util.Locale.ROOT));
        }catch(Exception ignored){}
    }
    private void deliverPair(){if(pendingPair!=null&&web!=null){String payload=pendingPair.toString();String qr=pendingPair.optString("qrValue","");web.evaluateJavascript("window.__tahaUiReady===true",ready->{if("true".equals(ready)){web.evaluateJavascript(qr.isEmpty()?"window.dispatchEvent(new CustomEvent('taha-pair-link',{detail:"+payload+"}))":"window.dispatchEvent(new CustomEvent('taha-qr-value',{detail:"+JSONObject.quote(qr)+"}))",null);pendingPair=null;}});}}
    @SuppressLint("SetJavaScriptEnabled") private void openLocal(){
        cancelFileSelection();if(bridge!=null)bridge.close();if(web!=null)web.destroy();root.removeAllViews();
        web=new WebView(this);web.setBackgroundColor(0xfff3f3f3);bridge=new ShopBridge(this,web);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setGeolocationEnabled(false);settings.setSaveFormData(false);settings.setSafeBrowsingEnabled(true);settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);web.addJavascriptInterface(bridge,"TahaNative");
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().setDomain("localhost").setHttpAllowed(true).addPathHandler("/",path->{try{String requested=path.isEmpty()?"index.html":path;if(requested.contains("..")||requested.startsWith("/"))return null;String mime=requested.endsWith(".js")?"application/javascript":requested.endsWith(".css")?"text/css":requested.endsWith(".html")?"text/html":requested.endsWith(".woff2")?"font/woff2":requested.endsWith(".png")?"image/png":requested.endsWith(".svg")?"image/svg+xml":"application/json";WebResourceResponse response=new WebResourceResponse(mime,"utf-8",getAssets().open(requested));if(requested.equals("index.html"))response.setResponseHeaders(java.util.Collections.singletonMap("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; font-src 'self'; connect-src 'self' https: wss: http: ws:; frame-src 'none'; object-src 'none'; base-uri 'none'"));return response;}catch(Exception ignored){return null;}}).build();
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !OriginPolicy.sameOrigin(ShopBridge.LOCAL_ORIGIN,request.getUrl().toString());}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){if(OriginPolicy.sameOrigin(ShopBridge.LOCAL_ORIGIN,request.getUrl().toString())){WebResourceResponse response=loader.shouldInterceptRequest(request.getUrl());return response==null?new WebResourceResponse("text/plain","utf-8",404,"Not Found",java.util.Collections.emptyMap(),new java.io.ByteArrayInputStream("Bundled resource not found".getBytes(java.nio.charset.StandardCharsets.UTF_8))):response;}return null;}
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,android.net.http.SslError error){handler.cancel();}
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())localFailure();}
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse error){if(request.isForMainFrame())localFailure();else if(BuildConfig.DEBUG)android.util.Log.w("TahaStaff","Resource request failed: HTTP "+error.getStatusCode());}
            @Override public void onPageFinished(WebView view,String url){deliverPair();}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onConsoleMessage(ConsoleMessage message){if(BuildConfig.DEBUG&&message.messageLevel()==ConsoleMessage.MessageLevel.ERROR)android.util.Log.w("TahaStaff","JavaScript error in bundled app; open Diagnostics. Message omitted to protect credentials.");return true;}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                cancelFileSelection();if(!OriginPolicy.sameOrigin(ShopBridge.LOCAL_ORIGIN,view.getUrl()))return false;fileCallback=callback;multipleFiles=params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE;
                try{if(params.isCaptureEnabled()){if(checkSelfPermission(android.Manifest.permission.CAMERA)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.CAMERA},PHOTO_PERMISSION);else openCameraIntent();}
                    else{Intent picker=new Intent(Intent.ACTION_GET_CONTENT);picker.setType("image/*");picker.addCategory(Intent.CATEGORY_OPENABLE);picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,multipleFiles);startActivityForResult(Intent.createChooser(picker,"Choose photo"),PHOTO_REQUEST);}}
                catch(Exception error){cancelFileSelection();Toast.makeText(MainActivity.this,"Camera unavailable. Try Choose Existing Photo.",Toast.LENGTH_LONG).show();}return true;
            }
        });
        root.addView(web,new LinearLayout.LayoutParams(-1,-1));web.loadUrl(ShopBridge.LOCAL_ORIGIN+"/index.html#/mobile");
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(()->{if(web!=null)web.evaluateJavascript("window.__tahaUiReady===true",ready->{if(!"true".equals(ready))localFailure();else deliverPair();});},12000);
    }
    private void localFailure(){root.removeAllViews();LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(32,48,32,32);TextView title=new TextView(this);title.setText("TAHA MOBILES\nSomething went wrong");title.setTextColor(0xffc62828);title.setTextSize(24);panel.addView(title);TextView message=new TextView(this);message.setText("The bundled interface could not start. No shop connection is needed to display it. App "+BuildConfig.VERSION_NAME);panel.addView(message);Button retry=new Button(this);retry.setText("Reload App");retry.setOnClickListener(v->openLocal());panel.addView(retry);Button diagnostics=new Button(this);diagnostics.setText("Diagnostics");diagnostics.setOnClickListener(v->{message.setText("Build: "+BuildConfig.VERSION_NAME+"\nLocal assets: startup failed\nInternet permission: declared\nNo passwords or tokens included.");});panel.addView(diagnostics);root.addView(panel);}
    @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("window.dispatchEvent(new Event('taha-app-resume'))",null);}}
    private void openCameraIntent(){try{cameraFile=bridge.beginCameraOriginal();cameraUri=FileProvider.getUriForFile(this,BuildConfig.APPLICATION_ID+".camera",cameraFile);Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);camera.putExtra(MediaStore.EXTRA_OUTPUT,cameraUri);camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);camera.setClipData(android.content.ClipData.newRawUri("Camera photo",cameraUri));startActivityForResult(camera,PHOTO_REQUEST);}catch(Exception error){cancelFileSelection();Toast.makeText(this,"Camera unavailable or retained-photo storage is full. Review saved photos or choose an existing photo.",Toast.LENGTH_LONG).show();}}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);boolean granted=results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED;if(request==SCAN_PERMISSION){if(granted)scanQr();else emitScan(null,"PERMISSION_DENIED","qr",null);}if(request==PHOTO_PERMISSION){if(granted)openCameraIntent();else{cancelFileSelection();Toast.makeText(this,"Camera permission is required. Choose Existing Photo or enable Camera in app settings.",Toast.LENGTH_LONG).show();web.evaluateJavascript("window.dispatchEvent(new Event('taha-photo-cancelled'))",null);}}}
    @Override protected void onPause(){if(web!=null){web.evaluateJavascript("window.dispatchEvent(new Event('taha-app-pause'))",null);web.onPause();}super.onPause();}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(request!=PHOTO_REQUEST)return;if(fileCallback==null){emitNetwork("taha-pending-photos");Toast.makeText(this,"Review retained camera photos in Requests if the app restarted.",Toast.LENGTH_LONG).show();return;}List<Uri> images=new ArrayList<>();
        if(result==RESULT_OK){if(cameraUri!=null&&cameraFile!=null&&cameraFile.length()>0&&cameraFile.length()<=32*1024*1024){images.add(cameraUri);lastCameraFile=cameraFile;}else if(data!=null){if(data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount()&&images.size()<(multipleFiles?12:1);i++){Uri uri=data.getClipData().getItemAt(i).getUri();if(safeImage(uri))images.add(uri);}}else if(safeImage(data.getData()))images.add(data.getData());}}
        ValueCallback<Uri[]> callback=fileCallback;fileCallback=null;callback.onReceiveValue(images.isEmpty()?null:images.toArray(new Uri[0]));if(images.isEmpty()){if(cameraFile!=null&&cameraFile.length()==0)bridge.acknowledgeOriginal(cameraFile);web.evaluateJavascript("window.dispatchEvent(new Event('taha-photo-cancelled'))",null);}cameraUri=null;cameraFile=null;
    }
    private boolean safeImage(Uri uri){if(uri==null||!"content".equals(uri.getScheme()))return false;try{String type=getContentResolver().getType(uri);if(type==null||!type.startsWith("image/"))return false;try(android.content.res.AssetFileDescriptor file=getContentResolver().openAssetFileDescriptor(uri,"r")){return file!=null&&(file.getLength()<0||file.getLength()<=32*1024*1024);}}catch(Exception ignored){return false;}}
    private void cancelFileSelection(){if(fileCallback!=null){fileCallback.onReceiveValue(null);fileCallback=null;}if(cameraUri!=null)revokeUriPermission(cameraUri,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);if(cameraFile!=null&&cameraFile.length()==0&&bridge!=null)bridge.acknowledgeOriginal(cameraFile);cameraFile=null;cameraUri=null;}
    @Override public void onBackPressed(){if(web!=null){web.evaluateJavascript("(function(){const close=document.querySelector('.mobile-drawer-close')||document.querySelector('.dialog-frame [aria-label=\"Close dialog\"]');if(close){close.click();return true;}return false;})()",value->{if(!"true".equals(value)){if(web.canGoBack())web.goBack();else super.onBackPressed();}});}else super.onBackPressed();}
    @Override protected void onDestroy(){if(networkManager!=null&&networkCallback!=null)networkManager.unregisterNetworkCallback(networkCallback);if(fileCallback!=null){fileCallback.onReceiveValue(null);fileCallback=null;}if(bridge!=null)bridge.close();if(web!=null)web.destroy();super.onDestroy();}
}



