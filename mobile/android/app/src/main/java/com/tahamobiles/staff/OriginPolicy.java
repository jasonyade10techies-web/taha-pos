package com.tahamobiles.staff;

import java.net.URI;
import java.util.Locale;

/** Server selection and navigation policy. No DNS resolution of untrusted hostnames. */
final class OriginPolicy {
    static String origin(String value, boolean debug) {
        try {
            URI uri = new URI(value.trim());
            String host = uri.getHost(), scheme = uri.getScheme();
            if (host == null || scheme == null || uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) return null;
            if (!(uri.getRawPath() == null || uri.getRawPath().isEmpty() || uri.getRawPath().equals("/"))) return null;
            if (uri.getPort() == 0 || uri.getPort() < -1 || uri.getPort() > 65535) return null;
            scheme = scheme.toLowerCase(Locale.ROOT); host = host.toLowerCase(Locale.ROOT);
            // Localhost on a phone refers to the phone itself, never the Windows counter.
            if (host.equals("localhost") || host.equals("127.0.0.1") || host.equals("::1")) return null;
            if (!scheme.equals("https") && !(debug && scheme.equals("http") && privateIpv4(host))) return null;
            int port=uri.getPort();if(scheme.equals("https")&&port==443||scheme.equals("http")&&port==80)port=-1;
            return new URI(scheme, null, host, port, null, null, null).toString();
        } catch (Exception ignored) { return null; }
    }
    static boolean privateIpv4(String host) {
        String[] parts = host.split("\\.");
        if (parts.length != 4) return false;
        int[] octets = new int[4];
        for (int i=0; i<4; i++) {
            if (!parts[i].matches("[0-9]{1,3}")) return false;
            octets[i] = Integer.parseInt(parts[i]); if (octets[i]>255) return false;
        }
        return octets[0]==10 || octets[0]==192 && octets[1]==168 || octets[0]==172 && octets[1]>=16 && octets[1]<=31;
    }
    static boolean sameOrigin(String origin, String url) {
        try {
            URI a=new URI(origin), b=new URI(url);
            return b.getUserInfo()==null && a.getScheme().equalsIgnoreCase(b.getScheme()) && a.getHost().equalsIgnoreCase(b.getHost()) && port(a)==port(b);
        } catch (Exception ignored) { return false; }
    }
    /** Public health probes never change the selected shop or carry session credentials. */
    static boolean healthProbe(String url,String method,boolean debug){
        try{URI uri=new URI(url);if(!method.equals("GET")||!"/api/v1/health".equals(uri.getPath())||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null)return false;
            return origin(new URI(uri.getScheme(),null,uri.getHost(),uri.getPort(),null,null,null).toString(),debug)!=null;
        }catch(Exception ignored){return false;}
    }
    private static int port(URI uri) { return uri.getPort()!=-1 ? uri.getPort() : uri.getScheme().equalsIgnoreCase("https") ? 443 : 80; }
}
