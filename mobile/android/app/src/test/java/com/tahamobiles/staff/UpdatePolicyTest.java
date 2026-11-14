package com.tahamobiles.staff;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.Assert.*;

public class UpdatePolicyTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();
    private static final String CERT = "fe4bd258ec8f80aa5aeb2fcc608e7fe42c2dd0af3931767ca8bfd84af3618a38";
    private JSONObject manifest() throws Exception {
        return new JSONObject().put("schemaVersion",1).put("channel","test")
            .put("applicationId","com.tahamobiles.staff.debug").put("versionName","0.5R.3-test")
            .put("versionCode",12).put("apkUrl","/downloads/taha-staff/apks/test/12/staff.apk")
            .put("sizeBytes",3).put("sha256","ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
            .put("signingCertificateSha256",CERT).put("releasedAt","2026-11-14T00:00:00Z")
            .put("minAndroidApi",26).put("minBackendApiVersion",1).put("required",false)
            .put("releaseNotes",new JSONArray().put("Updater test"));
    }
    private UpdatePolicy.Release release(JSONObject json) throws Exception {
        return UpdatePolicy.parse(json.toString().getBytes(StandardCharsets.UTF_8),"https://example.test","test");
    }
    @Test public void onlyHttpsOriginsWithoutCredentialsPathsQueriesOrFragmentsAreAccepted() {
        assertEquals("https://example.test",UpdatePolicy.origin("https://EXAMPLE.test:443/"));
        for(String bad:new String[]{"http://example.test","https://a:b@example.test","https://example.test/p","https://example.test?x=1","https://example.test/#x","https://example.test:0","https://example.test:65536","https://example.test\\evil","",null}) assertNull(bad,UpdatePolicy.origin(bad));
    }
    @Test public void redirectsStayOnExactHttpsOriginAndAreBounded() throws Exception {
        URI start=new URI("https://example.test/downloads/taha-staff/releases/test.json");
        assertEquals("https://example.test/next",UpdatePolicy.redirect("https://example.test",start,"/next",0).toString());
        for(String bad:new String[]{"https://evil.test/x","http://example.test/x","https://user@example.test/x","/x#secret","https://example.test:444/x"}) assertThrows(SecurityException.class,()->UpdatePolicy.redirect("https://example.test",start,bad,0));
        assertThrows(SecurityException.class,()->UpdatePolicy.redirect("https://example.test",start,"/next",3));
    }
    @Test public void manifestPreservesContractAndResolvesOnlyImmutableApkPaths() throws Exception {
        UpdatePolicy.Release r=release(manifest());
        assertEquals(12,r.versionCode);assertEquals("https://example.test/downloads/taha-staff/apks/test/12/staff.apk",r.apk.toString());
        for(String bad:new String[]{"https://example.test/staff.apk","//evil.test/staff.apk","/downloads/taha-staff/apks/test/12/../staff.apk","/downloads/taha-staff/apks/test/12/%2e%2e/staff.apk","/downloads/taha-staff/apks/stable/12/staff.apk","/downloads/taha-staff/apks/test/12/staff.apk?token=x"}) {
            JSONObject json=manifest().put("apkUrl",bad);assertThrows(SecurityException.class,()->release(json));
        }
    }
    @Test public void malformedAndOversizedMetadataIsRejectedWithoutCoercion() throws Exception {
        for(Object[] change:new Object[][]{{"schemaVersion",2},{"versionCode",0},{"versionCode",12.5},{"versionCode","12"},{"sizeBytes",67108865},{"sha256","A".repeat(64)},{"signingCertificateSha256","bad"},{"required","false"},{"releaseNotes",new JSONArray().put(3)},{"releasedAt","yesterday"},{"channel","stable"},{"minAndroidApi",0},{"minBackendApiVersion",-1}}) {
            JSONObject json=manifest().put((String)change[0],change[1]);assertThrows(SecurityException.class,()->release(json));
        }
        assertThrows(SecurityException.class,()->UpdatePolicy.parse(new byte[32769],"https://example.test","test"));
    }
    @Test public void compatibilityRejectsWrongPackageSignerDowngradeAndUnsupportedVersions() throws Exception {
        UpdatePolicy.Release r=release(manifest());
        Set<String> certs=Collections.singleton(CERT);
        assertEquals("available",UpdatePolicy.compatibility(r,"com.tahamobiles.staff.debug",11,certs,26,1));
        assertEquals("current",UpdatePolicy.compatibility(r,"com.tahamobiles.staff.debug",12,certs,26,1));
        assertEquals("current",UpdatePolicy.compatibility(r,"com.tahamobiles.staff.debug",13,certs,26,1));
        assertEquals("incompatible",UpdatePolicy.compatibility(r,"other.package",11,certs,26,1));
        assertEquals("incompatible",UpdatePolicy.compatibility(r,"com.tahamobiles.staff.debug",11,Collections.singleton("0".repeat(64)),26,1));
        assertEquals("incompatible",UpdatePolicy.compatibility(r,"com.tahamobiles.staff.debug",11,certs,25,1));
        assertEquals("incompatible",UpdatePolicy.compatibility(r,"com.tahamobiles.staff.debug",11,certs,26,0));
    }
    @Test public void archiveMustMatchAllInstalledSignersAndExactVersion() throws Exception {
        UpdatePolicy.Release r=release(manifest());Set<String> certs=Collections.singleton(CERT);
        UpdatePolicy.validateArchive(r,"com.tahamobiles.staff.debug",12,certs,"com.tahamobiles.staff.debug",11,certs);
        assertThrows(SecurityException.class,()->UpdatePolicy.validateArchive(r,"com.tahamobiles.staff.debug",12,new HashSet<>(Arrays.asList(CERT,"0".repeat(64))),"com.tahamobiles.staff.debug",11,certs));
        assertThrows(SecurityException.class,()->UpdatePolicy.validateArchive(r,"com.tahamobiles.staff.debug",13,certs,"com.tahamobiles.staff.debug",11,certs));
        assertThrows(SecurityException.class,()->UpdatePolicy.validateArchive(r,"com.tahamobiles.staff.debug",12,certs,"com.tahamobiles.staff.debug",12,certs));
    }
    @Test public void transferChecksExactSizeHashAndCancellationWithoutTouchingKnownGood() throws Exception {
        UpdatePolicy.Release r=release(manifest());File good=temporary.newFile("known-good.apk"),partial=temporary.newFile("pending.part");
        java.nio.file.Files.write(good.toPath(),new byte[]{7});
        UpdatePolicy.copyVerified(new ByteArrayInputStream("abc".getBytes(StandardCharsets.UTF_8)),partial,r,()->false,(done,total)->{});
        UpdatePolicy.verifyFile(partial,r);
        for(String bad:new String[]{"ab","abcd","xyz"}) assertThrows(IOException.class,()->UpdatePolicy.copyVerified(new ByteArrayInputStream(bad.getBytes(StandardCharsets.UTF_8)),partial,r,()->false,(done,total)->{}));
        assertThrows(InterruptedIOException.class,()->UpdatePolicy.copyVerified(new ByteArrayInputStream(new byte[]{1}),partial,r,()->true,(done,total)->{}));
        assertArrayEquals(new byte[]{7},java.nio.file.Files.readAllBytes(good.toPath()));
    }
    @Test public void operationGateRejectsOverlapAndInvalidatesCancelledWorkWhileAllowingRetry() {
        UpdatePolicy.Operations gate=new UpdatePolicy.Operations();long first=gate.begin();assertTrue(first>0);assertEquals(0,gate.begin());
        gate.cancel();assertFalse(gate.active(first));long retry=gate.begin();assertTrue(retry>first);assertFalse(gate.active(first));
        gate.finish(first);assertTrue(gate.active(retry));gate.finish(retry);assertFalse(gate.active(retry));gate.close();assertEquals(0,gate.begin());
    }
}
