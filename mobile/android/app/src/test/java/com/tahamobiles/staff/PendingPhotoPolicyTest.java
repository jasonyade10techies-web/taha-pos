package com.tahamobiles.staff;
import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.File;
import java.nio.file.Files;
import java.util.UUID;
import static org.junit.Assert.*;
public class PendingPhotoPolicyTest{
 @Rule public TemporaryFolder temporary=new TemporaryFolder();
 private final String shop="http://192.168.1.8:3001";
 private String record(String id) throws Exception {return new JSONObject().put("captureId",id).put("requestId",UUID.randomUUID().toString()).put("shop",shop+"/api/v1").put("createdAt",System.currentTimeMillis()).put("data","data:image/jpeg;base64,AQIDBA==").toString();}
 @Test public void captureFilesUseOnlyUuidNames(){assertTrue(PendingPhotos.validId("8f7a155a-073a-4822-9ed3-294c458091fa"));for(String id:new String[]{"../secret","/photo","foo.json","8f7a155a-073a-4822-9ed3-294c458091fa/../secret",""})assertFalse(PendingPhotos.validId(id));}
 @Test public void pendingPhotoIsBinaryAndSurvivesRestartOnlyForSameShop() throws Exception {File root=temporary.newFolder();String id=UUID.randomUUID().toString();assertTrue(new PendingPhotos(root).save(record(id),shop));File folder=new File(root,"pending-photos");assertArrayEquals(new byte[]{1,2,3,4},Files.readAllBytes(new File(folder,id+".photo").toPath()));assertFalse(new String(Files.readAllBytes(new File(folder,id+".json").toPath()),java.nio.charset.StandardCharsets.UTF_8).contains("data:image"));PendingPhotos restarted=new PendingPhotos(root);assertEquals(1,new JSONArray(restarted.read(shop)).length());assertEquals(0,new JSONArray(restarted.read("http://192.168.1.9:3001")).length());restarted.remove(id);assertEquals(0,new JSONArray(restarted.read(shop)).length());}
 @Test public void queueIsBoundedAndLogoutClearsFiles() throws Exception {File root=temporary.newFolder();PendingPhotos photos=new PendingPhotos(root);for(int i=0;i<12;i++)assertTrue(photos.save(record(UUID.randomUUID().toString()),shop));assertFalse(photos.save(record(UUID.randomUUID().toString()),shop));photos.clear();assertEquals(0,new File(root,"pending-photos").listFiles().length);}
 @Test public void olderPhotosStayRecoverableAndWrongOriginCannotSave() throws Exception {File root=temporary.newFolder();PendingPhotos photos=new PendingPhotos(root);String id=UUID.randomUUID().toString();assertFalse(photos.save(record(id),"http://192.168.1.9:3001"));assertTrue(photos.save(record(id),shop));for(File f:new File(root,"pending-photos").listFiles())assertTrue(f.setLastModified(System.currentTimeMillis()-31*60*1000));assertEquals(1,new JSONArray(photos.read(shop)).length());}
}

