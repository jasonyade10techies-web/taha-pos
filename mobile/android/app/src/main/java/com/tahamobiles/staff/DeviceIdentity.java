package com.tahamobiles.staff;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.UUID;

/** Random app-install identity; never reads a serial, phone number, or hardware identifier. */
final class DeviceIdentity {
    private final File file;
    private String id;
    DeviceIdentity(File directory) { file = new File(directory, "device-id"); }

    synchronized String getId() {
        if (id != null) return id;
        try {
            if (file.isFile() && file.length() == 36) {
                String stored = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
                if (stored.equals(UUID.fromString(stored).toString())) {
                    id = stored;
                    return id;
                }
            }
        } catch (IOException | IllegalArgumentException ignored) { }
        id = UUID.randomUUID().toString();
        File temporary = new File(file.getParentFile(), "device-id.tmp");
        try {
            Files.write(temporary.toPath(), id.getBytes(StandardCharsets.UTF_8));
            try {
                Files.move(temporary.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temporary.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ignored) {
            // A full or unavailable filesystem still allows this running app to identify itself.
            temporary.delete();
        }
        return id;
    }

    static String deviceName(String manufacturer, String model) {
        String maker = clean(manufacturer), name = clean(model);
        if (name.isEmpty()) return maker.isEmpty() ? "Android device" : maker + " Android device";
        if (maker.isEmpty() || name.toLowerCase(Locale.ROOT).startsWith(maker.toLowerCase(Locale.ROOT))) return name;
        return maker + " " + name;
    }

    private static String clean(String value) {
        if (value == null || "unknown".equalsIgnoreCase(value.trim())) return "";
        String result = value.replaceAll("[\\p{Cntrl}]", " ").trim();
        return result.substring(0, Math.min(result.length(), 64));
    }
}
