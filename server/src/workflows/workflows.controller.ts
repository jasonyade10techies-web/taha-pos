import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import { WorkflowsService } from './workflows.service';

@ApiTags('Repairs and shifts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('stores/:storeId')
export class WorkflowsController {
  constructor(@Inject(WorkflowsService) private readonly workflows: WorkflowsService) {}
  @Get('services') @ApiOperation({ summary: 'Read service catalog without financial cost data' })
  services(@Req() r: AuthRequest, @Param('storeId') s: string) { return this.workflows.services(r.actor, s); }
  @Get('services/material-locations/:productId') @ApiOperation({ summary: 'Read eligible service material box allocations without cost data' })
  materialLocations(@Req() r: AuthRequest, @Param('storeId') s: string, @Param('productId') id: string) { return this.workflows.materialLocations(r.actor, s, id); }
  @Get('services/:id')
  service(@Req() r: AuthRequest, @Param('storeId') s: string, @Param('id') id: string) { return this.workflows.services(r.actor, s, id); }
  @Post('services')
  saveService(@Req() r: AuthRequest, @Param('storeId') s: string, @Body() b: unknown) { return this.workflows.saveService(r.actor, s, b); }
  @Get(['jobs', 'repair-jobs'])
  jobs(@Req() r: AuthRequest, @Param('storeId') s: string) { return this.workflows.jobs(r.actor, s); }
  @Get(['jobs/:id', 'repair-jobs/:id'])
  job(@Req() r: AuthRequest, @Param('storeId') s: string, @Param('id') id: string) { return this.workflows.jobs(r.actor, s, id); }
  @Post(['jobs', 'repair-jobs'])
  saveJob(@Req() r: AuthRequest, @Param('storeId') s: string, @Body() b: unknown) { return this.workflows.saveJob(r.actor, s, b); }
  @Get('shifts')
  shifts(@Req() r: AuthRequest, @Param('storeId') s: string) { return this.workflows.shifts(r.actor, s); }
  @Get('shifts/:id')
  shift(@Req() r: AuthRequest, @Param('storeId') s: string, @Param('id') id: string) { return this.workflows.shifts(r.actor, s, id); }
  @Post('shifts')
  saveShift(@Req() r: AuthRequest, @Param('storeId') s: string, @Body() b: unknown) { return this.workflows.saveShift(r.actor, s, b); }
  @Get('shifts/:id/closing')
  closing(@Req() r: AuthRequest, @Param('storeId') s: string, @Param('id') id: string) { return this.workflows.closing(r.actor, s, id); }
  @Post('shifts/:id/close') @ApiOperation({ summary: 'Reconcile actual confirmed cash ledger events and freeze shift history' })
  close(@Req() r: AuthRequest, @Param('storeId') s: string, @Param('id') id: string, @Body() b: unknown) { return this.workflows.close(r.actor, s, id, b); }
}
