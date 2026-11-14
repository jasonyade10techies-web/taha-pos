export const APK_LIMIT = 64 * 1024 * 1024;
export function validateRelease(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid release manifest.');
  const r = input;
  const integer = (key, min, max = 2147483647) => Number.isSafeInteger(r[key]) && r[key] >= min && r[key] <= max;
  const string = (key, max) => typeof r[key] === 'string' && r[key].length > 0 && r[key].length <= max;
  if (r.schemaVersion !== 1 || !['test','stable'].includes(r.channel) || !string('applicationId',255) ||
      r.applicationId !== `com.tahamobiles.staff${r.channel === 'test' ? '.debug' : ''}` ||
      !string('versionName',128) || !integer('versionCode',1) || !integer('sizeBytes',1,APK_LIMIT) ||
      !integer('minAndroidApi',26) || !integer('minBackendApiVersion',1) ||
      !/^[a-f0-9]{64}$/.test(r.sha256) || !/^[a-f0-9]{64}$/.test(r.signingCertificateSha256) ||
      !string('releasedAt',64) || !Number.isFinite(Date.parse(r.releasedAt)) || typeof r.required !== 'boolean' ||
      !Array.isArray(r.releaseNotes) || r.releaseNotes.length > 100 ||
      r.releaseNotes.some(n => typeof n !== 'string' || n.length > 2000) ||
      (r.sourceCommit !== undefined && !/^[a-f0-9]{40}$/.test(r.sourceCommit))) throw Error('Invalid release manifest.');
  const pattern = new RegExp(`^/downloads/taha-staff/apks/${r.channel}/${r.versionCode}/[A-Za-z0-9][A-Za-z0-9._-]{0,139}\\.apk$`);
  if (!string('apkUrl',1024) || !pattern.test(r.apkUrl) || JSON.stringify(r).length > 32768) throw Error('Invalid APK address.');
  return r;
}
