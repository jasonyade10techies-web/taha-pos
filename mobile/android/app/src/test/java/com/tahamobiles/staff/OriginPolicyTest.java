package com.tahamobiles.staff;
import org.junit.Test;
import static org.junit.Assert.*;
public class OriginPolicyTest {
    @Test public void httpsShopOrigin() { assertEquals("https://shop.example", OriginPolicy.origin("https://shop.example/",false)); }
    @Test public void testBuildAcceptsPrivateLan() { assertEquals("http://192.168.1.10:1423",OriginPolicy.origin("http://192.168.1.10:1423",true)); }
    @Test public void releaseRejectsHttp() { assertNull(OriginPolicy.origin("http://192.168.1.10:1423",false)); }
    @Test public void rejectPublicHttpAndMalformedOrigins() { for(String value:new String[]{"http://example.com","http://192.168.500.2","https://user:pass@shop.example","https://shop.example/path","https://shop.example?token=secret","https://shop.example#fragment","javascript:alert(1)","http://localhost:1423","http://127.0.0.1:1423","http://169.254.1.1"}) assertNull(value,OriginPolicy.origin(value,true)); }
    @Test public void navigationIsOriginBound() { assertTrue(OriginPolicy.sameOrigin("https://shop.example","https://shop.example:443/profile")); for(String url:new String[]{"https://shop.example.evil/profile","http://shop.example/profile","https://shop.example:9443/profile","https://a@shop.example/profile","file:///etc/passwd","javascript:alert(1)"}) assertFalse(url,OriginPolicy.sameOrigin("https://shop.example",url)); }
    @Test public void preserveActualApiHostAndPort(){assertEquals("http://192.168.1.8:3001",OriginPolicy.origin(" http://192.168.1.8:3001/ ",true));assertEquals("192.168.1.8",java.net.URI.create(OriginPolicy.origin("http://192.168.1.8:3001",true)).getHost());assertEquals(3001,java.net.URI.create(OriginPolicy.origin("http://192.168.1.8:3001",true)).getPort());}
    @Test public void normalizeDefaultPorts(){assertEquals("https://shop.example",OriginPolicy.origin("https://shop.example:443",false));}
    @Test public void publicHealthCanProbeAnotherValidShop(){assertTrue(OriginPolicy.healthProbe("http://192.168.1.9:3001/api/v1/health","GET",true));assertTrue(OriginPolicy.healthProbe("https://shop.example/api/v1/health","GET",false));}
    @Test public void healthExceptionCannotReachProtectedPaths(){for(String url:new String[]{"http://192.168.1.9:3001/api/v1/auth/refresh","http://192.168.1.9:3001/api/v1/health?token=x","http://user:pass@192.168.1.9:3001/api/v1/health","http://example.com/api/v1/health"})assertFalse(OriginPolicy.healthProbe(url,"GET",true));assertFalse(OriginPolicy.healthProbe("http://192.168.1.9:3001/api/v1/health","POST",true));assertFalse(OriginPolicy.healthProbe("http://192.168.1.9:3001/api/v1/health","GET",false));}
}
