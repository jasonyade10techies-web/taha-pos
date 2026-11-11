package com.tahamobiles.staff;

import java.io.File;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;

public class DeviceIdentityTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();

    @Test public void idSurvivesRecreationAndDiffersBetweenInstalls() throws Exception {
        File firstInstall = temporary.newFolder();
        String firstId = new DeviceIdentity(firstInstall).getId();
        assertEquals(firstId, UUID.fromString(firstId).toString());
        assertEquals(firstId, new DeviceIdentity(firstInstall).getId());
        assertNotEquals(firstId, new DeviceIdentity(temporary.newFolder()).getId());
    }

    @Test public void invalidStoredIdIsReplacedAndPersisted() throws Exception {
        File install = temporary.newFolder();
        Files.write(new File(install, "device-id").toPath(), "not-a-device".getBytes(StandardCharsets.UTF_8));
        String id = new DeviceIdentity(install).getId();
        assertEquals(id, UUID.fromString(id).toString());
        assertEquals(id, new DeviceIdentity(install).getId());
    }

    @Test public void deviceNamesUseModelWithoutRepeatingManufacturer() {
        assertEquals("Samsung SM-A525F", DeviceIdentity.deviceName("Samsung", "SM-A525F"));
        assertEquals("samsung Galaxy A52", DeviceIdentity.deviceName("Samsung", "samsung Galaxy A52"));
        assertEquals("Pixel 8", DeviceIdentity.deviceName(null, "Pixel 8"));
        assertEquals("Android device", DeviceIdentity.deviceName("unknown", "unknown"));
    }
}
