import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateAppearance} from '../src/business/appearance';
const good={font:'Manrope',primary:'#FFC107',accent:'#E53935',success:'#168344',warning:'#9A5B0A',danger:'#DC2626'};
test('appearance accepts branded local fonts and readable semantic colors',()=>{assert.equal(validateAppearance(good).font,'Manrope');});
test('appearance rejects CSS injection and unreadable white status colors',()=>{assert.throws(()=>validateAppearance({...good,primary:'url(javascript:alert(1))'}));assert.throws(()=>validateAppearance({...good,success:'#FFFFFF'}));assert.throws(()=>validateAppearance({...good,font:'https://arbitrary-font.example'}));});
