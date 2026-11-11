/** Connection origin only. No credentials, paths, query strings or shorthand IPv4. */
export function parseShopAddress(value: string, allowLanHttp: boolean) {
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw))
    throw new Error(
      "Enter the complete http:// or https:// shop address and API port.",
    );
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Use the shop server address without a path, password or query string.",
    );
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error(
      "Localhost refers to this phone. Use the PC's LAN IP address.",
    );
  const originalHost = raw.match(/^https?:\/\/([^/:?#]+)/i)?.[1];
  if (
    originalHost &&
    /^[\d.]+$/.test(originalHost) &&
    originalHost !== url.hostname
  )
    throw new Error("Enter a complete IPv4 address, such as 192.168.1.8.");
  const octets = url.hostname.split(".").map(Number);
  const privateIp =
    octets.length === 4 &&
    octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (octets[0] === 10 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && allowLanHttp && privateIp)
  )
    throw new Error(
      "Use HTTPS. Test builds also accept private LAN HTTP addresses.",
    );
  if (url.port === "0") throw new Error("Use an API port between 1 and 65535.");
  return {
    baseUrl: url.origin,
    protocol: url.protocol,
    host: url.hostname,
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
    display: url.host,
  };
}
