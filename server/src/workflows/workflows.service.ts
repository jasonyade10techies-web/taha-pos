import { Inject, Injectable } from '@nestjs/common';
import { Database, type Actor } from '../database/database.service';
import { CounterGateway } from '../realtime/counter.gateway';
import { closingInput, repairInput, serviceInput, shiftInput, workflowId } from './validation';

@Injectable()
export class WorkflowsService {
  constructor(@Inject(Database) private readonly db: Database, @Inject(CounterGateway) private readonly realtime: CounterGateway) {}
  private async rpc(actor: Actor, name: string, args: unknown[]) {
    return this.db.asActor(actor, async db => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) value`, args)).rows[0].value);
  }
  private async write(actor: Actor, store: string, name: string, args: unknown[], resource: string) {
    const value = await this.rpc(actor, name, args);
    await this.realtime.changed(actor, store, resource);
    return value;
  }
  services(actor: Actor, store: string, id?: string) { return this.rpc(actor, 'repair_service_data', [workflowId(store), id ? workflowId(id) : null]); }
  materialLocations(actor: Actor, store: string, product: string) { return this.rpc(actor, 'service_material_locations', [workflowId(store), workflowId(product)]); }
  saveService(actor: Actor, store: string, body: unknown) { return this.write(actor, store, 'save_repair_service', [workflowId(store), serviceInput(body)], 'services'); }
  jobs(actor: Actor, store: string, id?: string) { return this.rpc(actor, 'repair_job_data', [workflowId(store), id ? workflowId(id) : null]); }
  saveJob(actor: Actor, store: string, body: unknown) { return this.write(actor, store, 'save_repair_job', [workflowId(store), repairInput(body)], 'jobs'); }
  shifts(actor: Actor, store: string, id?: string) { return this.rpc(actor, 'shift_data', [workflowId(store), id ? workflowId(id) : null]); }
  saveShift(actor: Actor, store: string, body: unknown) { return this.write(actor, store, 'save_shift', [workflowId(store), shiftInput(body)], 'shifts'); }
  closing(actor: Actor, store: string, id: string) { return this.rpc(actor, 'shift_closing', [workflowId(store), workflowId(id)]); }
  close(actor: Actor, store: string, id: string, body: unknown) { return this.write(actor, store, 'close_shift', [workflowId(store), workflowId(id), closingInput(body)], 'shifts'); }
}
