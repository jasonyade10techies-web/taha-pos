import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'dist-*', 'server/**', 'node_modules', 'src-tauri', 'test-results', 'test-results-api', 'test-results-counter', 'test-results-connection', 'playwright-report', '.test-postgres', '.tools/**', 'mobile/android/**', 'artifacts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['scripts/managed-release/main.js','scripts/managed-release/server.cjs'],languageOptions:{sourceType:'commonjs'},rules:{'@typescript-eslint/no-require-imports':['error',{allow:['^http$','^\\./server\\.cjs$']}] } },
  { files: ['public/sw.js'], languageOptions: { globals: globals.serviceworker } },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: { ...reactHooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] },
  },
);
