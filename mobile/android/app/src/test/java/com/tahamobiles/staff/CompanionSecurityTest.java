package com.tahamobiles.staff;
import org.junit.Test;
import static org.junit.Assert.*;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
public class CompanionSecurityTest {
 @Test public void pinAcceptsOnlyTheScannedPublicKey() throws Exception {
  KeyPairGenerator generator=KeyPairGenerator.getInstance("EC");generator.initialize(256);
  byte[] expected=generator.generateKeyPair().getPublic().getEncoded(),other=generator.generateKeyPair().getPublic().getEncoded();
  String pin=CompanionSecurity.hex(MessageDigest.getInstance("SHA-256").digest(expected));
  assertTrue(CompanionSecurity.matchesPin(expected,pin));
  assertFalse(CompanionSecurity.matchesPin(other,pin));
  assertFalse(CompanionSecurity.matchesPin(expected,""));
  assertFalse(CompanionSecurity.matchesPin(expected,pin.toUpperCase(java.util.Locale.ROOT)));
 }
}
