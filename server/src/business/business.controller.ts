import {Body,Controller,Delete,Get,Inject,Param,Patch,Post,Put,Query,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';
import {AuthGuard,type AuthRequest} from '../auth/auth.guard';
import {BusinessService} from './business.service';
import {MediaService} from '../media/media.service';
import {AuthService} from '../auth/auth.service';
type JsonBody=Record<string,unknown>;
@ApiTags('Business') @ApiBearerAuth() @UseGuards(AuthGuard) @Controller('stores/:storeId')
export class BusinessController {
 constructor(@Inject(BusinessService) private readonly business:BusinessService,@Inject(MediaService) private readonly media:MediaService,@Inject(AuthService) private readonly auth:AuthService){}
 private run(r:AuthRequest,s:string,k:string,b:JsonBody={},q:JsonBody={},id?:string){return this.business.operation(r.actor,s,k,b,q,id);}
 @Get('products/search') search(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('q') query=''){return this.business.search(r.actor,s,query);}
 @Get('products/pos') pos(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'products.pos');}
 @Get('products/values') values(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.read(r.actor,s,'values');}
 @Post('products/values') saveValue(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'products.value',b);}
 @Get('products') products(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.read(r.actor,s,'products');}
 @Get('products/:id/cost') cost(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.business.read(r.actor,s,'cost',id);}
 @Get('products/:id') product(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.business.read(r.actor,s,'product',id);}
 @Post('products') saveProduct(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'products.save',b);}
 @Post('products/:id/duplicate') duplicate(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.run(r,s,'products.duplicate',{},{},id);}
 @Delete('products/:id') archive(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.run(r,s,'products.archive',{},{},id);}
 @Get('locations') locations(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.read(r.actor,s,'locations');}
 @Post('locations') saveLocation(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'locations.save',b);}
 @Delete('locations/:id') archiveLocation(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.run(r,s,'locations.archive',{},{},id);}
 @Get('suppliers') suppliers(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.read(r.actor,s,'suppliers');}
 @Post('suppliers') saveSupplier(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'suppliers.save',b);}
 @Get('inventory/balances') balances(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.read(r.actor,s,'balances');}
 @Get('inventory/movements') movements(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.read(r.actor,s,'movements');}
 @Get('inventory/conditions') conditions(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('productId') productId?:string){return this.run(r,s,'inventory.conditions',{}, {productId});}
 @Get('inventory/damaged') damaged(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('productId') productId?:string){return this.run(r,s,'inventory.damaged',{}, {productId});}
 @Get('inventory/condition-locations') conditionLocations(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('condition') condition='Damaged'){return this.run(r,s,'inventory.conditionLocations',{}, {condition});}
 @Post('inventory/damaged/actions') damageAction(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'inventory.damaged.action',b);}
 @Get('inventory/receipts') receipts(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.receipts(r.actor,s);}
 @Post('inventory/receipts') receive(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'inventory.receipts',b);}
 @Post('inventory/transfer') transfer(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'inventory.transfer',b);}
 @Post('inventory/adjust') adjust(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'inventory.adjust',b);}
 @Get('customers') customers(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.business.data(r.actor,s,'customers',q);}
 @Get('customers/:id/activity') customerActivity(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Query() q:JsonBody){return this.run(r,s,'customers.activity',{},q,id);}
 @Get('customers/:id/activity/:eventId') customerActivityDetail(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Param('eventId') eventId:string){return this.run(r,s,'customers.activityDetail',{}, {eventId},id);}
 @Post('customers/:id/notes') customerNote(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:JsonBody){return this.run(r,s,'customers.note',b,{},id);}
 @Get('reminders') reminders(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('customerId') customerId?:string){return this.run(r,s,'reminders.list',{}, {customerId});}
 @Get('reminders/alerts') reminderAlerts(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('customerId') customerId?:string){return this.run(r,s,'reminders.alerts',{}, {customerId});}
 @Post('reminders/history') reminderHistory(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'reminders.history',b);}
 @Post('customers') customer(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'customers.save',b);}
 @Get('customers/:id/balance') balance(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.run(r,s,'customers.balance',{},{},id);}
 @Get('sales') sales(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.run(r,s,'sales.list',{},q);}
 @Get('sales/:id') sale(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){return this.run(r,s,'sales.get',{},{},id);}
 @Post('sales') complete(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'sales.complete',b);}
 @Post('sales/:id/void') void(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:JsonBody){return this.run(r,s,'sales.void',{...b,saleId:id});}
 @Get('returns') returns(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.business.data(r.actor,s,'returns',q);}
 @Get('returns/receipts') returnReceipts(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.run(r,s,'returns.receipts',{},q);}
 @Post('returns') returnItem(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'sales.return',b);}
 @Get('credit/ledger') ledger(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.business.data(r.actor,s,'ledger',q);}
 @Get('credit/ledger/full') customerLedger(@Req() r:AuthRequest,@Param('storeId') s:string,@Query('customerId') customerId:string){return this.run(r,s,'customers.ledger',{}, {customerId});}
 @Post('credit/receive') collect(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'credit.receive',b);}
 @Get('payment-methods') methods(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.data(r.actor,s,'methods');}
 @Post('payment-methods') method(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'payments.save',b);}
 @Get('payments') payments(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.business.data(r.actor,s,'payments',q);}
 @Post('payments/reverse') reverse(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'payments.reverse',b);}
 @Get('coupons') coupons(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.data(r.actor,s,'coupons');}
 @Post('coupons') coupon(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'coupons.save',b);}
 @Post('coupons/quote') quote(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'coupons.quote',b);}
 @Get('mobile/my-shift') myShift(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'mobile.myShift');}
 @Get('mobile/approvals') mobileApprovals(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'mobile.approvals');}
 @Get('approvals') approvers(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.run(r,s,'approvals.list',{},q);}
 @Post('approvals') approval(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'approvals.create',b);}
 @Get('out-for-test') tests(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.data(r.actor,s,'tests');}
 @Post('out-for-test') sendTest(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'tests.send',b);}
 @Post('out-for-test/update') updateTest(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'tests.update',b);}
 @Get('employees') employees(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'employees.list');}
 @Post('employees') employee(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'employees.save',b);}
 @Post('accounts') account(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:{profileId:string,email:string,password:string}){return this.auth.staffAccount(r.actor,s,b.profileId,b.email,b.password);}
 @Put('employees/:id/permissions') permissions(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:JsonBody){return this.run(r,s,'employees.permissions',b,{},id);}
 @Put('employees/:id/pin') pin(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:JsonBody){return this.run(r,s,'employees.pin',b,{},id);}
 @Patch('profile') async profile(@Req() r:AuthRequest,@Body() b:{fullName:string,phone:string,avatarPath?:string}){await this.business.profile(r.actor,b.fullName,b.phone);if(b.avatarPath!==undefined)await this.media.avatar(r.actor,b.avatarPath);return {ok:true};}
 @Get('settings') settings(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'settings.get');}
 @Put('settings') setting(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'settings.save',b);}
 @Get('appearance') appearance(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'appearance.get');}
 @Put('appearance') setAppearance(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'appearance.save',b);}
 @Get('reports') report(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.run(r,s,'reports.summary',{},q);}
 @Get('reports/employees') employeeReport(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.run(r,s,'reports.employees',{},q);}
 @Get('dashboard') dashboard(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'dashboard');}
 @Get('dashboard/range') range(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.run(r,s,'dashboard.range',{},q);}
 @Get('profit') profit(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'profit');}
 @Get('audit') audit(@Req() r:AuthRequest,@Param('storeId') s:string){return this.business.read(r.actor,s,'audit');}
 @Get('transaction-result') result(@Req() r:AuthRequest,@Param('storeId') s:string,@Query() q:JsonBody){return this.run(r,s,'transaction.result',{},q);}
 @Get('devices') devices(@Req() r:AuthRequest,@Param('storeId') s:string){return this.run(r,s,'devices.get',{action:'list'});}
 @Get('devices/:id') async device(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string){const rows=await this.run(r,s,'devices.get',{action:'list'});return rows.find((d:{id:string})=>d.id===id)??null;}
 @Post('devices') saveDevice(@Req() r:AuthRequest,@Param('storeId') s:string,@Body() b:JsonBody){return this.run(r,s,'devices.get',{...b,action:b.action??'purchase'});}
 @Patch('devices/:id') statusDevice(@Req() r:AuthRequest,@Param('storeId') s:string,@Param('id') id:string,@Body() b:JsonBody){return this.run(r,s,'devices.get',{...b,id,action:'status'});}
}
