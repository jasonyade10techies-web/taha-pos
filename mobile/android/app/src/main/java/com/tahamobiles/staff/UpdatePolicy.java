package com.tahamobiles.staff;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.function.BooleanSupplier;

/** Pure release policy: no Android state, credentials, network, or business storage. */
final class UpdatePolicy {
    static final int MANIFEST_LIMIT=32768;
    static final long APK_LIMIT=64L*1024*1024;
    static final class Release {
        final String applicationId,versionName,sha256,certificate,channel,json;
        final long versionCode,sizeBytes;
        final int minAndroidApi,minBackendApiVersion;
        final URI apk;
        Release(JSONObject value,URI apk)throws Exception {
            this.apk=apk;json=value.toString();applicationId=value.getString("applicationId");versionName=value.getString("versionName");
            sha256=value.getString("sha256");certificate=value.getString("signingCertificateSha256");channel=value.getString("channel");
            versionCode=integer(value,"versionCode",1,Integer.MAX_VALUE);sizeBytes=integer(value,"sizeBytes",1,APK_LIMIT);
            minAndroidApi=(int)integer(value,"minAndroidApi",1,Integer.MAX_VALUE);minBackendApiVersion=(int)integer(value,"minBackendApiVersion",1,Integer.MAX_VALUE);
        }
    }
    static String origin(String value) {
        try {
            if(value==null||value.length()>2048)return null;
            URI uri=new URI(value.trim());
            if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getRawFragment()!=null||uri.getRawQuery()!=null)return null;
            if(uri.getPort()==0||uri.getPort() < -1||uri.getPort()>65535)return null;
            if(uri.getRawPath()!=null&&!uri.getRawPath().isEmpty()&&!uri.getRawPath().equals("/"))return null;
            return new URI("https",null,uri.getHost().toLowerCase(Locale.ROOT),uri.getPort()==443?-1:uri.getPort(),null,null,null).toString();
        } catch(Exception invalid){return null;}
    }
    private static boolean sameOrigin(String origin,URI uri) {
        try {
            return uri.getUserInfo()==null&&uri.getRawFragment()==null&&origin.equals(origin(new URI(uri.getScheme(),null,uri.getHost(),uri.getPort(),null,null,null).toString()));
        }catch(Exception invalid){return false;}
    }
    static URI redirect(String origin,URI current,String location,int count) {
        try {
            if(count>=3||location==null||location.length()>2048||!sameOrigin(origin,current))throw new SecurityException();
            URI next=current.resolve(new URI(location));
            if(!sameOrigin(origin,next))throw new SecurityException();
            return next;
        }catch(Exception invalid){throw new SecurityException("UNSAFE_REDIRECT");}
    }
    static Release parse(byte[] bytes,String source,String channel) {
        try {
            if(bytes==null||bytes.length==0||bytes.length>MANIFEST_LIMIT||origin(source)==null)throw new SecurityException();
            JSONObject json=new JSONObject(new String(bytes,StandardCharsets.UTF_8));
            if(integer(json,"schemaVersion",1,1)!=1||!channel.equals(string(json,"channel",6))||!(channel.equals("test")||channel.equals("stable")))throw new SecurityException();
            if(!string(json,"applicationId",255).matches("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+"))throw new SecurityException();
            string(json,"versionName",128);long code=integer(json,"versionCode",1,Integer.MAX_VALUE);
            integer(json,"sizeBytes",1,APK_LIMIT);integer(json,"minAndroidApi",1,Integer.MAX_VALUE);integer(json,"minBackendApiVersion",1,Integer.MAX_VALUE);
            if(!string(json,"sha256",64).matches("[a-f0-9]{64}")||!string(json,"signingCertificateSha256",64).matches("[a-f0-9]{64}"))throw new SecurityException();
            Instant.parse(string(json,"releasedAt",64));
            if(!(json.get("required") instanceof Boolean)||!(json.get("releaseNotes") instanceof JSONArray))throw new SecurityException();
            JSONArray notes=json.getJSONArray("releaseNotes");if(notes.length()>100)throw new SecurityException();
            for(int i=0;i<notes.length();i++)if(!(notes.get(i) instanceof String)||notes.getString(i).length()>2000)throw new SecurityException();
            if(json.has("sourceCommit")&&!string(json,"sourceCommit",40).matches("[a-fA-F0-9]{40}"))throw new SecurityException();
            String path=string(json,"apkUrl",1024);
            if(!path.matches("/downloads/taha-staff/apks/"+channel+"/"+code+"/[A-Za-z0-9][A-Za-z0-9._-]{0,139}\\.apk"))throw new SecurityException();
            return new Release(json,new URI(origin(source)+path));
        }catch(Exception invalid){throw new SecurityException("INVALID_MANIFEST");}
    }
    private static long integer(JSONObject json,String key,long minimum,long maximum)throws Exception {
        Object value=json.get(key);
        if(!(value instanceof Integer||value instanceof Long)||((Number)value).longValue()<minimum||((Number)value).longValue()>maximum)throw new SecurityException();
        return ((Number)value).longValue();
    }
    private static String string(JSONObject json,String key,int maximum)throws Exception {
        Object value=json.get(key);if(!(value instanceof String)||((String)value).isEmpty()||((String)value).length()>maximum)throw new SecurityException();return (String)value;
    }
    static String compatibility(Release r,String app,long version,Set<String> signers,int androidApi,int backendApi) {
        if(!r.applicationId.equals(app)||signers==null||signers.isEmpty()||!signers.contains(r.certificate)||r.minAndroidApi>androidApi||r.minBackendApiVersion>backendApi)return "incompatible";
        return r.versionCode>version?"available":"current";
    }
    static void validateArchive(Release r,String app,long version,Set<String> signers,String installedApp,long installedVersion,Set<String> installedSigners) {
        if(!r.applicationId.equals(app)||!app.equals(installedApp)||version!=r.versionCode||version<=installedVersion||installedSigners==null||installedSigners.isEmpty()||!installedSigners.equals(signers)||!installedSigners.contains(r.certificate))throw new SecurityException("APK_IDENTITY_MISMATCH");
    }
    interface Progress {void accept(long done,long total);}
    static void copyVerified(InputStream input,File file,Release release,BooleanSupplier cancelled,Progress progress)throws IOException {
        try(FileOutputStream output=new FileOutputStream(file)) {
            MessageDigest digest=digest();byte[] buffer=new byte[16384];long count=0;int read;
            while(true) {
                if(cancelled.getAsBoolean()||Thread.currentThread().isInterrupted())throw new InterruptedIOException("CANCELLED");
                read=input.read(buffer);if(read==-1)break;
                count+=read;if(count>release.sizeBytes||count>APK_LIMIT)throw new IOException("APK_SIZE_MISMATCH");
                output.write(buffer,0,read);digest.update(buffer,0,read);progress.accept(count,release.sizeBytes);
            }
            if(count!=release.sizeBytes)throw new IOException("APK_SIZE_MISMATCH");
            if(!hex(digest.digest()).equals(release.sha256))throw new IOException("APK_HASH_MISMATCH");
            output.getFD().sync();
        }
    }
    static void verifyFile(File file,Release release)throws IOException {
        if(!file.isFile()||file.length()!=release.sizeBytes||file.length()>APK_LIMIT)throw new IOException("APK_SIZE_MISMATCH");
        MessageDigest digest=digest();long count=0;byte[] bytes=new byte[16384];int read;
        try(InputStream input=new FileInputStream(file)){while((read=input.read(bytes))!=-1){count+=read;if(count>release.sizeBytes)throw new IOException("APK_SIZE_MISMATCH");digest.update(bytes,0,read);}}
        if(count!=release.sizeBytes||!hex(digest.digest()).equals(release.sha256))throw new IOException("APK_HASH_MISMATCH");
    }
    private static MessageDigest digest(){try{return MessageDigest.getInstance("SHA-256");}catch(Exception impossible){throw new IllegalStateException(impossible);}}
    static String hex(byte[] bytes){StringBuilder value=new StringBuilder(bytes.length*2);for(byte item:bytes)value.append(String.format(Locale.ROOT,"%02x",item&255));return value.toString();}
    static final class Operations {
        private long epoch,active;private boolean closed;
        synchronized long begin(){if(closed||active!=0)return 0;return active=++epoch;}
        synchronized void cancel(){epoch++;active=0;}
        synchronized boolean active(long token){return !closed&&token!=0&&token==active;}
        synchronized void finish(long token){if(token==active)active=0;}
        synchronized void close(){cancel();closed=true;}
    }
}
