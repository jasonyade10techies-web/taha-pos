export function DeploymentIndicator() {
  if(import.meta.env.VITE_DEPLOYMENT_ENV!=='staging') return null;
  return <div role="status" aria-label="Deployment environment" className="staging-indicator">STAGING · Test shop data</div>;
}
