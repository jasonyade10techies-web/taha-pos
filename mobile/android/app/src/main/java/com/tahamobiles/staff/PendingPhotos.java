package com.tahamobiles.staff;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.nio.file.AtomicMoveNotSupportedException;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;
import org.json.JSONArray;
/** Immutable binary captures and journaled metadata in app-private storage. */
final class PendingPhotos {
 private static final Object LOCK=new Object();
 private static final int MAX_PHOTO=8*1024*1024,MAX_TOTAL=64*1024*1024;
 private final File folder;
 PendingPhotos(File root){folder=new File(root,"pending-photos");folder.mkdirs();}
 static boolean validId(String id){return id!=null&&id.matches("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}");}
 private File file(String id,String suffix){if(!validId(id))throw new IllegalArgumentException();return new File(folder,id+suffix);}
 private File[] entries(){File[] files=folder.listFiles();if(files==null)return new File[0];Arrays.sort(files,(a,b)->a.getName().compareTo(b.getName()));return files;}
 private static String hash(byte[] bytes)throws Exception {StringBuilder value=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))value.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return value.toString();}
 private static void durableWrite(File target,byte[] bytes)throws Exception {try(FileOutputStream output=new FileOutputStream(target)){output.write(bytes);output.getFD().sync();}}
 private static void move(File source,File target)throws Exception {try{Files.move(source.toPath(),target.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException unsupported){Files.move(source.toPath(),target.toPath(),StandardCopyOption.REPLACE_EXISTING);}}
 private static boolean validShop(String value){try{if(value==null||value.length()>2048)return false;java.net.URI uri=new java.net.URI(value);String path=uri.getRawPath();return (path==null||path.isEmpty()||path.equals("/")||path.equals("/api/v1"))&&uri.getRawQuery()==null&&uri.getRawFragment()==null&&uri.getUserInfo()==null&&OriginPolicy.origin(new java.net.URI(uri.getScheme(),null,uri.getHost(),uri.getPort(),null,null,null).toString(),true)!=null;}catch(Exception invalid){return false;}}
 private JSONObject metadata(File source,String id)throws Exception {
  if(!source.isFile()||source.length()>64*1024)throw new IllegalArgumentException();
  JSONObject record=new JSONObject(new String(Files.readAllBytes(source.toPath()),StandardCharsets.UTF_8));
  if(!id.equals(record.getString("captureId"))||!validId(record.getString("requestId"))||!record.getString("mime").matches("image/(jpeg|png|webp)")||!validShop(record.getString("shop")))throw new IllegalArgumentException();
  return record;
 }
 private byte[] binary(JSONObject record,File source)throws Exception {
  if(!source.isFile()||source.length()<1||source.length()>MAX_PHOTO)throw new IllegalArgumentException();
  byte[] bytes=Files.readAllBytes(source.toPath());
  if(record.has("byteLength")&&record.getLong("byteLength")!=bytes.length)throw new IllegalArgumentException();
  if(record.has("sha256")&&!hash(bytes).equals(record.getString("sha256")))throw new IllegalArgumentException();
  return bytes;
 }
 /** Finish only an intact, fully described save. Damaged/ambiguous bytes stay put. */
 private void recover(){for(File pending:entries())if(pending.getName().endsWith(".pending")){String id=pending.getName().replaceFirst("\\.pending$","");if(!validId(id))continue;try{
  JSONObject record=metadata(pending,id);if(!record.has("sha256")||!record.has("byteLength"))continue;
  File committed=file(id,".json");if(committed.exists()){
   JSONObject previous=metadata(committed,id);if(!previous.getString("requestId").equals(record.getString("requestId"))||!OriginPolicy.sameOrigin(previous.getString("shop"),record.getString("shop")))continue;
  }
  File photo=file(id,".photo"),partial=file(id,".part");binary(record,photo.exists()?photo:partial);
  if(!photo.exists())move(partial,photo);move(pending,committed);
 }catch(Exception damaged){/* Retain this entry; other captures still recover. */}}}
 boolean save(String encoded,String shop){synchronized(LOCK){try{
  recover();if(encoded==null||encoded.length()>12*1024*1024)return false;
  JSONObject input=new JSONObject(encoded);String id=input.getString("captureId"),request=input.getString("requestId"),origin=input.getString("shop"),data=input.getString("data");
  if(!validId(id)||!validId(request)||!validShop(origin)||!OriginPolicy.sameOrigin(shop,origin)||!data.matches("(?s)^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=\\r\\n]+$"))return false;
  byte[] bytes=Base64.getMimeDecoder().decode(data.substring(data.indexOf(',')+1));if(bytes.length<1||bytes.length>MAX_PHOTO)return false;
  String mime=data.substring(5,data.indexOf(';'));File json=file(id,".json"),photo=file(id,".photo");
  if(json.exists()||photo.exists()||file(id,".pending").exists()||file(id,".part").exists()){
   JSONObject existing=metadata(json,id);return existing.getString("requestId").equals(request)&&OriginPolicy.sameOrigin(existing.getString("shop"),origin)&&existing.getString("mime").equals(mime)&&Arrays.equals(binary(existing,photo),bytes);
  }
  long total=0;Set<String> ids=new HashSet<>();for(File entry:entries()){total+=entry.length();String candidate=entry.getName().split("\\.",2)[0];if(validId(candidate))ids.add(candidate);}
  if(total+bytes.length+4096>MAX_TOTAL||ids.size()>=12)return false;
  JSONObject record=new JSONObject().put("captureId",id).put("requestId",request).put("shop",origin).put("createdAt",input.optLong("createdAt",System.currentTimeMillis())).put("mime",mime).put("byteLength",bytes.length).put("sha256",hash(bytes));
  // A journal lets the next process finish an interrupted photo/metadata rename.
  durableWrite(file(id,".part"),bytes);durableWrite(file(id,".pending"),record.toString().getBytes(StandardCharsets.UTF_8));
  move(file(id,".part"),photo);move(file(id,".pending"),json);return true;
 }catch(Exception failure){return false;}}}
 String read(String shop){synchronized(LOCK){recover();JSONArray result=new JSONArray();for(File source:entries())if(source.getName().endsWith(".json")){String id=source.getName().replaceFirst("\\.json$","");if(!validId(id))continue;try{
  JSONObject record=metadata(source,id);if(!OriginPolicy.sameOrigin(shop,record.getString("shop")))continue;
  record.put("data","data:"+record.getString("mime")+";base64,"+Base64.getEncoder().encodeToString(binary(record,file(id,".photo"))));result.put(record);
 }catch(Exception damaged){/* One corrupt record must not hide healthy photos. */}}return result.toString();}}
 void remove(String id){synchronized(LOCK){if(validId(id))for(String suffix:new String[]{".photo",".json",".pending",".part"})file(id,suffix).delete();}}
 int issues(String shop){synchronized(LOCK){recover();int count=0;Set<String> ids=new HashSet<>();for(File source:entries()){String id=source.getName().split("\\.",2)[0];if(validId(id))ids.add(id);}for(String id:ids)try{JSONObject record=metadata(file(id,".json"),id);if(OriginPolicy.sameOrigin(shop,record.getString("shop")))binary(record,file(id,".photo"));}catch(Exception damaged){count++;}return count;}}
 void clear(){synchronized(LOCK){for(File source:entries())if(source.isFile())source.delete();}}
 // Retained until acknowledged, deliberately discarded, or confirmed sign-out.
}
