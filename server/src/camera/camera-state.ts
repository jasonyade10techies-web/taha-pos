export type CameraAssignmentState='UNASSIGNED'|'ASSIGNED'|'CLAIMED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'|'EXPIRED';
export function assignmentState(job:Record<string,unknown>):CameraAssignmentState{
 if(job.status==='received')return 'COMPLETED';
 if(job.status==='cancelled')return 'CANCELLED';
 if(new Date(String(job.expires_at))<=new Date())return 'EXPIRED';
 if(!job.device_session_id)return 'UNASSIGNED';
 if(['opened','captured','uploading'].includes(String(job.status)))return 'IN_PROGRESS';
 return job.claim_hash?'ASSIGNED':'CLAIMED';
}
