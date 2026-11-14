import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NotFoundException} from '@nestjs/common';
import type {Response} from 'express';
import type {Configuration} from '../src/config';
import {DevelopmentDownloadController} from '../src/development-download.controller';
test('the current test APK is never exposed by a production application',()=>{
 const controller=new DevelopmentDownloadController({production:true} as Configuration);
 assert.throws(()=>controller.downloadReadiness({} as Response),NotFoundException);
 assert.throws(()=>controller.downloadPhase5D2({} as Response),NotFoundException);
});
