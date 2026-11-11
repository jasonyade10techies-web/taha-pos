package com.tahamobiles.staff;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.cert.X509Certificate;
import java.security.spec.ECGenParameterSpec;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/** Per-installation proof key and encrypted refresh credential never leave native storage. */
final class CompanionSecurity {
    private static final String IDENTITY="taha-companion-identity-v1", STORAGE="taha-companion-storage-v1";
    private final SharedPreferences preferences;
    CompanionSecurity(Context context){preferences=context.getSharedPreferences("companion-security",Context.MODE_PRIVATE);}
    private KeyStore keys() throws Exception {KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);return store;}
    private synchronized void identity() throws Exception {
        if(keys().containsAlias(IDENTITY))return;
        KeyPairGenerator generator=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");
        generator.initialize(new KeyGenParameterSpec.Builder(IDENTITY,KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY).setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build());generator.generateKeyPair();
    }
    String sign(String message) throws Exception {identity();Signature signer=Signature.getInstance("SHA256withECDSA");signer.initSign((java.security.PrivateKey)keys().getKey(IDENTITY,null));signer.update(message.getBytes(StandardCharsets.UTF_8));return Base64.encodeToString(signer.sign(),Base64.NO_WRAP);}
    private String publicKey() throws Exception {identity();return "-----BEGIN PUBLIC KEY-----\n"+Base64.encodeToString(keys().getCertificate(IDENTITY).getPublicKey().getEncoded(),Base64.NO_WRAP)+"\n-----END PUBLIC KEY-----";}
    synchronized JSONObject begin(String qr,String deviceId,String name) throws Exception {
        if(qr==null||qr.length()>2048)throw new SecurityException();URI uri=new URI(qr);
        if(!"taha-mobile".equals(uri.getScheme())||!"enroll".equals(uri.getHost())||uri.getRawFragment()!=null||uri.getRawUserInfo()!=null)throw new SecurityException();
        JSONObject params=new JSONObject();for(String item:uri.getRawQuery().split("&")){String[] part=item.split("=",2);if(part.length!=2)throw new SecurityException();String key=URLDecoder.decode(part[0],"UTF-8");if(params.has(key))throw new SecurityException();params.put(key,URLDecoder.decode(part[1],"UTF-8"));}
        String shop=params.getString("shop"),pin=params.getString("pin"),id=params.getString("id"),challenge=params.getString("challenge"),store=params.getString("store"),terminal=params.getString("terminal");
        URI address=new URI(shop);
        if(!"https".equals(address.getScheme())||address.getHost()==null||address.getRawUserInfo()!=null||address.getRawQuery()!=null||address.getRawFragment()!=null||!(address.getPath().isEmpty()||address.getPath().equals("/"))||!pin.matches("[a-f0-9]{64}")||!id.matches("[a-f0-9-]{36}")||!store.matches("[a-f0-9-]{36}")||!challenge.matches("[a-f0-9]{64}")||terminal.isEmpty()||terminal.length()>100||java.time.Instant.parse(params.getString("expires")).toEpochMilli()<=System.currentTimeMillis())throw new SecurityException();
        clear();preferences.edit().putString("origin",shop).putString("pin",pin).putString("pending-id",id).putString("pending-challenge",challenge).apply();
        JSONObject body=new JSONObject();body.put("storeId",store);body.put("terminalId",terminal);body.put("deviceId",deviceId);body.put("deviceName",name);body.put("publicKey",publicKey());body.put("challenge",challenge);body.put("signature",sign("taha-enroll-v1\n"+id+"\n"+challenge+"\n"+store+"\n"+terminal+"\n"+deviceId));
        JSONObject result=new JSONObject();result.put("shop",shop);result.put("id",id);result.put("challenge",challenge);result.put("body",body);result.put("fingerprint",hex(MessageDigest.getInstance("SHA-256").digest(keys().getCertificate(IDENTITY).getPublicKey().getEncoded())));return result;
    }
    synchronized JSONObject complete(String id,String challenge) throws Exception {
        if(!id.equals(preferences.getString("pending-id",""))||!challenge.equals(preferences.getString("pending-challenge","")))throw new SecurityException();
        JSONObject result=new JSONObject();result.put("challenge",challenge);result.put("signature",sign("taha-complete-v1\n"+id+"\n"+challenge));return result;
    }
    boolean active(){return preferences.contains("refresh");}
    String origin(){return preferences.getString("origin","");}
    synchronized void clear(){preferences.edit().clear().commit();}
    void changeOrigin(String next){if(!origin().isEmpty()&&!origin().equals(next))clear();}
    private SecretKey storageKey() throws Exception {
        if(!keys().containsAlias(STORAGE)){KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder(STORAGE,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();}
        return (SecretKey)keys().getKey(STORAGE,null);
    }
    synchronized void retain(String token) throws Exception {
        if(!token.matches("[a-f0-9]{64}")||origin().isEmpty())throw new SecurityException();
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,storageKey());
        cipher.updateAAD(origin().getBytes(StandardCharsets.UTF_8));byte[] encrypted=cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        if(!preferences.edit().putString("refresh",Base64.encodeToString(encrypted,Base64.NO_WRAP)).putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).commit())throw new SecurityException();
    }
    synchronized JSONObject refresh() throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,storageKey(),new GCMParameterSpec(128,Base64.decode(preferences.getString("iv",""),Base64.DEFAULT)));cipher.updateAAD(origin().getBytes(StandardCharsets.UTF_8));
        String token=new String(cipher.doFinal(Base64.decode(preferences.getString("refresh",""),Base64.DEFAULT)),StandardCharsets.UTF_8);
        JSONObject body=new JSONObject();body.put("refreshToken",token);body.put("signature",sign("taha-refresh-v1\n"+token));return body;
    }
    static String hex(byte[] bytes){StringBuilder result=new StringBuilder();for(byte b:bytes)result.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return result.toString();}
    static boolean matchesPin(byte[] publicKey,String pin) throws Exception {return pin!=null&&pin.matches("[a-f0-9]{64}")&&MessageDigest.isEqual(hex(MessageDigest.getInstance("SHA-256").digest(publicKey)).getBytes(StandardCharsets.US_ASCII),pin.getBytes(StandardCharsets.US_ASCII));}
    void protect(HttpsURLConnection connection) throws Exception {
        String pin=preferences.getString("pin","");if(pin.isEmpty())return;
        if(!OriginPolicy.sameOrigin(origin(),connection.getURL().toString()))throw new SecurityException();
        SSLContext tls=SSLContext.getInstance("TLS");tls.init(null,new TrustManager[]{new X509TrustManager(){
            public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}
            public void checkClientTrusted(X509Certificate[] chain,String authType) throws java.security.cert.CertificateException {throw new java.security.cert.CertificateException("Client certificates are unsupported");}
            public void checkServerTrusted(X509Certificate[] chain,String authType) throws java.security.cert.CertificateException {try{if(chain.length==0)throw new SecurityException();chain[0].checkValidity();if(!matchesPin(chain[0].getPublicKey().getEncoded(),pin))throw new SecurityException();}catch(Exception error){throw new java.security.cert.CertificateException("Shop certificate pin mismatch",error);}}
        }},null);
        connection.setSSLSocketFactory(tls.getSocketFactory());
        // The scanned SPKI authenticates the counter, including self-signed LAN certificates.
        connection.setHostnameVerifier((host,session)->host.equals(connection.getURL().getHost()));
    }
}
