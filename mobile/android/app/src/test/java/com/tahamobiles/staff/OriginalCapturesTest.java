package com.tahamobiles.staff;
import java.io.File;
import java.nio.file.Files;
import org.json.JSONArray;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;
public class OriginalCapturesTest {
 @Rule public TemporaryFolder temporary=new TemporaryFolder();
 private final String shop="https://shop.example.test";
 @Test public void originalSurvivesProcessRecreationAndIsScopedToShop() throws Exception {
  File root=temporary.newFolder();OriginalCaptures store=new OriginalCaptures(root);File photo=store.begin(shop);Files.write(photo.toPath(),new byte[]{1,2,3});
  OriginalCaptures restarted=new OriginalCaptures(root);JSONArray recovered=new JSONArray(restarted.read(shop));assertEquals(1,recovered.length());String id=recovered.getJSONObject(0).getString("id");
  assertEquals(0,new JSONArray(restarted.read("https://other.example.test")).length());assertNull(restarted.find(id,"https://other.example.test"));assertArrayEquals(new byte[]{1,2,3},Files.readAllBytes(restarted.find(id,shop).toPath()));
 }
 @Test public void noAutomaticDeletionOfOldOrIncompletePhotos() throws Exception {
  File root=temporary.newFolder();OriginalCaptures store=new OriginalCaptures(root);File photo=store.begin(shop);Files.write(photo.toPath(),new byte[]{1});assertTrue(photo.setLastModified(1));
  new OriginalCaptures(root).read(shop);assertTrue(photo.exists());
 }
 @Test public void acknowledgementRemovesOnlyTheSelectedOriginal() throws Exception {
  File root=temporary.newFolder();OriginalCaptures store=new OriginalCaptures(root);File a=store.begin(shop),b=store.begin(shop);Files.write(a.toPath(),new byte[]{1});Files.write(b.toPath(),new byte[]{2});
  store.remove(a.getName().replace(".jpg",""),shop);assertFalse(a.exists());assertTrue(b.exists());assertNull(store.find("../secret",shop));
 }
 @Test public void corruptMetadataCannotHideAnotherOriginal() throws Exception {
  File root=temporary.newFolder();OriginalCaptures store=new OriginalCaptures(root);File a=store.begin(shop),b=store.begin(shop);Files.write(a.toPath(),new byte[]{1});Files.write(b.toPath(),new byte[]{2});
  File metadata=new File(a.getParentFile(),a.getName().replace(".jpg",".json"));Files.write(metadata.toPath(),new byte[]{0});assertEquals(1,new JSONArray(new OriginalCaptures(root).read(shop)).length());assertTrue(a.exists());
 }
 @Test public void quotaPreventsSilentOverwriteAndExplicitLogoutClears() throws Exception {
  OriginalCaptures store=new OriginalCaptures(temporary.newFolder());for(int i=0;i<12;i++)store.begin(shop);
  try{store.begin(shop);fail("The camera must stop before retained originals are overwritten.");}catch(java.io.IOException expected){}
  store.clear();assertNotNull(store.begin(shop));
 }
}
