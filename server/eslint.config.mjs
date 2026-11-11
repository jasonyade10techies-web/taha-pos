import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
 {ignores:['dist/**','node_modules/**','data/**']},
 eslint.configs.recommended,...tseslint.configs.recommended,
 {files:['**/*.{ts,mjs}'],languageOptions:{globals:globals.node},rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},
 {files:['test/**/*.ts'],rules:{'@typescript-eslint/no-explicit-any':'off'}},
);
