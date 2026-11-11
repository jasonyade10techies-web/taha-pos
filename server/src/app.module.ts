import {SyncController} from './sync/sync.controller';
import {EnrollmentController} from './auth/enrollment.controller';
import {EnrollmentService} from './auth/enrollment.service';
import {CashReconciliationService} from './sync/cash-reconciliation.service';
import {ReceiptController} from './receipts/receipt.controller';
import {ReceiptService} from './receipts/receipt.service';
import {Module,type DynamicModule} from '@nestjs/common';
import {CONFIG,configuration} from './config';
import {Database} from './database/database.service';
import {AuthService} from './auth/auth.service';
import {AuthGuard} from './auth/auth.guard';
import {AuthController} from './auth/auth.controller';
import {BusinessService} from './business/business.service';
import {BusinessController} from './business/business.controller';
import {CounterGateway} from './realtime/counter.gateway';
import {PollingGateway} from './realtime/polling.gateway';
import {CameraService} from './camera/camera.service';
import {CameraController} from './camera/camera.controller';
import {PushService} from './camera/push.service';
import {LocalFileStorage} from './media/file-storage';
import {MediaService} from './media/media.service';
import {MediaController,MediaReadController} from './media/media.controller';
import {WorkflowsController} from './workflows/workflows.controller';
import {WorkflowsService} from './workflows/workflows.service';
import {HealthController} from './health.controller';
import {DisplayController,PublicDisplayController} from './display/display.controller';
import {DisplayService} from './display/display.service';
import {DevelopmentDownloadController} from './development-download.controller';
@Module({})
export class AppModule{
 static register():DynamicModule{
  const config=configuration();
  return {module:AppModule,controllers:[EnrollmentController,SyncController,ReceiptController,AuthController,BusinessController,CameraController,MediaController,MediaReadController,WorkflowsController,HealthController,DisplayController,PublicDisplayController,...(config.cloud?[]:[DevelopmentDownloadController])],providers:[EnrollmentService,CashReconciliationService,ReceiptService,{provide:CONFIG,useValue:config},Database,AuthService,AuthGuard,BusinessService,...(config.cloud?[{provide:CounterGateway,useClass:PollingGateway}]:[CounterGateway]),CameraService,PushService,LocalFileStorage,MediaService,WorkflowsService,DisplayService]};
 }
}
