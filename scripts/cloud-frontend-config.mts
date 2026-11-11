/** Public browser configuration only. Cloud access always uses the same-origin proxy. */
export function validateCloudFrontend(env: Record<string, string | undefined>, mode: string, vercel = false) {
  const deployment = env.VITE_DEPLOYMENT_ENV?.trim();
  const cloud = vercel || mode === 'staging' || deployment === 'staging' || deployment === 'production';
  if (!cloud) return false;
  const reject = (message: string): never => {throw new Error(`Cloud frontend: ${message}`);};
  if (!['staging','production'].includes(deployment || '')) reject('set VITE_DEPLOYMENT_ENV to staging or production.');
  if (env.VITE_DATA_PROVIDER !== 'api' || env.VITE_USE_MOCK_AUTH !== 'false') reject('the API provider and real authentication are required.');
  if (env.VITE_BUNDLED_MOBILE === 'true' || env.VITE_MOBILE_TEST === 'true') reject('native/test mobile bundles cannot be published as the cloud browser app.');
  for (const key of ['VITE_API_URL','VITE_API_BASE_URL','VITE_DEVICE_BRIDGE_URL']) {
    const value=env[key]?.trim();
    if(value && value!=='/api/v1') reject(`${key} must use /api/v1 through the same-origin proxy.`);
  }
  if(env.VITE_MOBILE_SHOP_URL?.trim()) reject('VITE_MOBILE_SHOP_URL belongs to a native build, not cloud browsers.');
  for(const [key,value] of Object.entries(env)) {
    if(!key.startsWith('VITE_') || !value) continue;
    if(/(?:SECRET|PASSWORD|PRIVATE_KEY|DATABASE|DB_URL|STORAGE_TOKEN|ACCESS_TOKEN|SERVICE_ROLE|API_KEY)/i.test(key) || /(?:postgres(?:ql)?:\/\/|-----BEGIN (?:RSA |EC )?PRIVATE KEY|sb_secret_)/i.test(value)) reject(`${key} may contain a server credential; remove it from browser configuration.`);
  }
  return true;
}

export function validatedApiOrigin(value: string) {
  let url: URL;
  try {url=new URL(value);} catch {throw new Error('Supply the actual deployed HTTPS API origin with --api-origin.');}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:' || url.username || url.password || url.port || url.search || url.hash || url.pathname!=='/' ||
    !host.includes('.') || host.endsWith('.') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host) ||
    /(?:^|\.)(?:localhost|local|internal|invalid|test|example|example\.com|example\.net|example\.org)$/.test(host)) {
    throw new Error('API origin must be an actual public HTTPS host without credentials, port, path, query or fragment.');
  }
  return url.origin;
}
