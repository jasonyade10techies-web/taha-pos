import { spawn } from 'node:child_process';
// Deliberately nonfunctional test key and local test endpoint. Playwright intercepts every backend request.
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','1421','--mode','authorization-test'],{
  stdio:'inherit', env:{ ...process.env, VITE_DATA_PROVIDER:'supabase', VITE_USE_MOCK_AUTH:'false', VITE_SUPABASE_URL:'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only_not_a_real_credential', VITE_SUPABASE_ANON_KEY:'', VITE_SUPABASE_GOOGLE_ENABLED:'false' },
});
child.on('exit',(code)=>{process.exitCode=code??1;});
