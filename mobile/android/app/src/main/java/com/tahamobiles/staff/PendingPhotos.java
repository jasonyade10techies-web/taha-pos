package com.tahamobiles.staff;
import java.io.File;
import java.nio.file.Files;
import java.util.Base64;
import org.json.JSONObject;
import org.json.JSONArray;
/** Bounded binary files in app-private storage; never WebView/localStorage photo persistence. */
final class PendingPhotos{
 private final File folder;
 PendingPhotos(File root){folder=new File(root,"pending-photos");folder.mkdirs();}
 static boolean validId(String id){return id!=null&&id.matches("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}");}
 synchronized boolean save(String encoded,String shop){try{JSONObject record=new JSONObject(encoded);String id=record.getString("captureId"),request=record.getString("requestId"),origin=record.getString("shop"),data=record.getString("data");if(!validId(id)||!validId(request)||!OriginPolicy.sameOrigin(shop,origin)||!data.matches("(?s)^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=\\r\\n]+$"))return false;
  byte[] bytes=Base64.getMimeDecoder().decode(data.substring(data.indexOf(',')+1));if(bytes.length>8*1024*1024)return false;File[] files=folder.listFiles();long total=0;int count=0;if(files!=null)for(File f:files){total+=f.length();if(f.getName().endsWith(".photo"))count++;}if(total+bytes.length>64*1024*1024||count>=12)return false;
  record.remove("data");record.put("mime",data.substring(5,data.indexOf(';')));Files.write(new File(folder,id+".photo").toPath(),bytes);Files.write(new File(folder,id+".json").toPath(),record.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));return true;
 }catch(Exception ignored){return false;}}
 synchronized String read(String shop){JSONArray result=new JSONArray();try{File[] files=folder.listFiles();if(files!=null)for(File file:files)if(file.getName().endsWith(".json")){JSONObject record=new JSONObject(new String(Files.readAllBytes(file.toPath()),java.nio.charset.StandardCharsets.UTF_8));if(!OriginPolicy.sameOrigin(shop,record.optString("shop")))continue;String id=record.getString("captureId");if(!validId(id))continue;record.put("data","data:"+record.getString("mime")+";base64,"+Base64.getEncoder().encodeToString(Files.readAllBytes(new File(folder,id+".photo").toPath())));result.put(record);}}catch(Exception ignored){}return result.toString();}
 synchronized void remove(String id){if(validId(id)){new File(folder,id+".photo").delete();new File(folder,id+".json").delete();}}
 synchronized void clear(){File[] files=folder.listFiles();if(files!=null)for(File file:files)if(file.isFile())file.delete();}
 // Retained until acknowledged, deliberately discarded, or confirmed sign-out.
}

