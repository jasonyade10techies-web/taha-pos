export interface AndroidRelease {
 schemaVersion:1; channel:'test'|'stable'; applicationId:string; versionName:string; versionCode:number;
 apkUrl:string; sizeBytes:number; sha256:string; signingCertificateSha256:string; releasedAt:string;
 minAndroidApi:number; minBackendApiVersion:number; required:boolean; releaseNotes:string[]; sourceCommit?:string;
}
export const APK_LIMIT:number;
export function validateRelease(input:unknown):AndroidRelease;
