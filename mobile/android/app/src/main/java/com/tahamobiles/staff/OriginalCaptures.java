package com.tahamobiles.staff;
import java.io.File;
import java.io.IOException;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.json.JSONObject;
import org.json.JSONArray;
/** Camera originals outlive the Activity and WebView callback. Never age-delete an unsent image. */
final class OriginalCaptures {
 private static final Object LOCK=new Object();
 private final File folder;
 OriginalCaptures(File root){folder=new File(root,"camera-originals");folder.mkdirs();}
 private File[] files(){File[] values=folder.listFiles();return values==null?new File[0]:values;}
 private JSONObject metadata(String id,String shop)throws Exception {
  if(!PendingPhotos.validId(id))throw new IOException();File file=new File(folder,id+".json");if(!file.isFile()||file.length()>4096)throw new IOException();
  JSONObject record=new JSONObject(new String(Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8));
  if(!id.equals(record.getString("id"))||!OriginPolicy.sameOrigin(shop,record.getString("shop")))throw new IOException();return record;
 }
 File begin(String shop)throws IOException{synchronized(LOCK){
  if(OriginPolicy.origin(shop,true)==null)throw new IOException("Select a shop before opening the camera.");
  int count=0;long bytes=0;for(File file:files()){if(file.getName().endsWith(".json"))count++;bytes+=file.length();}
  if(count>=12||bytes>32*1024*1024||folder.getUsableSpace()<40*1024*1024)throw new IOException("Save or discard retained camera photos before taking another.");
  String id=UUID.randomUUID().toString();File photo=new File(folder,id+".jpg");
  try{JSONObject record=new JSONObject().put("id",id).put("shop",shop).put("createdAt",System.currentTimeMillis());
   try(FileOutputStream output=new FileOutputStream(new File(folder,id+".json"))){output.write(record.toString().getBytes(StandardCharsets.UTF_8));output.getFD().sync();}
   if(!photo.createNewFile())throw new IOException();return photo;
  }catch(Exception failure){throw new IOException("Could not preserve a camera original.",failure);}
 }}
 String read(String shop){synchronized(LOCK){JSONArray result=new JSONArray();for(File file:files())if(file.getName().endsWith(".json"))try{String id=file.getName().replace(".json","");JSONObject record=metadata(id,shop);File photo=new File(folder,id+".jpg");result.put(new JSONObject().put("id",id).put("createdAt",record.getLong("createdAt")).put("bytes",photo.isFile()?photo.length():0));}catch(Exception damaged){/* Preserve damaged entries without hiding healthy originals. */}return result.toString();}}
 File find(String id,String shop){synchronized(LOCK){try{metadata(id,shop);File file=new File(folder,id+".jpg");return file.isFile()&&file.length()>0&&file.length()<=32*1024*1024?file:null;}catch(Exception invalid){return null;}}}
 void remove(String id,String shop){synchronized(LOCK){try{metadata(id,shop);new File(folder,id+".jpg").delete();new File(folder,id+".json").delete();}catch(Exception invalid){/* Never traverse or remove another shop's photo. */}}}
 void clear(){synchronized(LOCK){for(File file:files())if(file.isFile())file.delete();}}
}
