import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,

} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import jwt from "jsonwebtoken";
import { Database } from "../database/database.service";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { CONFIG, type Configuration } from "../config";
import { uuid } from "../business/business.service";
import { CashReconciliationService, type CashCaptureInput } from "./cash-reconciliation.service";

export function offlineInvoice(key: string) {
  return "TM-INV-O-" + uuid(key).toUpperCase();
}
@ApiTags("Desktop synchronization")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("stores/:storeId/sync")
export class SyncController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(CONFIG) private readonly config: Configuration,
    @Inject(CashReconciliationService) private readonly cash: CashReconciliationService,
  ) {}
  @Get("catalog") async catalog(
    @Req() req: AuthRequest,
    @Param("storeId") store: string,
    @Query("ids") input = "",
  ) {
    uuid(store);
    const ids = [...new Set(input.split(",").filter(Boolean))];
    if (ids.length > 200)
      throw new BadRequestException(
        "Refresh up to 200 changed products at once.",
      );
    ids.forEach(uuid);
    return this.db.asActor(
      req.actor,
      async (db) =>
        (
          await db.query(
            "select coalesce(jsonb_agg(p),'[]'::jsonb) value from jsonb_array_elements(public.get_pos_products($1)) p where p->>'id'=any($2::text[])",
            [store, ids],
          )
        ).rows[0].value,
    );
  }
  @Get("changes") async changes(
    @Req() req: AuthRequest,
    @Param("storeId") store: string,
    @Query("after") after = "0",
    @Query("bootstrap") bootstrap = "0",
  ) {
    uuid(store);
    if (!/^\d{1,19}$/.test(after) || BigInt(after)>9223372036854775807n || !['0','1'].includes(bootstrap))
      throw new BadRequestException("Invalid synchronization reference.");
    const permissions: Record<string, string[]> = {
      products: ["sales.create", "inventory.view"],
      locations: ["inventory.view", "sales.create"],
      stock: ["inventory.view", "sales.create"],
      customers: ["customers.view", "customers.edit", "sales.create", "credit.create", "credit.receive_payment", "inventory.transfer"],
      sales: ["sales.view", "sales.create", "returns.create"],
      payments: ["sales.view", "payments.approve_electronic", "payments.reverse", "credit.receive_payment"],
      services: ["sales.create", "services.save_catalog", "repair.services.manage"],
      jobs: ["repairs.view", "repairs.create", "repairs.edit"],
      shifts: ["shifts.manage", "reports.view"],
      catalog: ["sales.create", "inventory.view", "products.create", "products.edit"],
      suppliers: ["inventory.view", "inventory.receive", "products.create", "products.edit"],
      receiving: ["inventory.view", "inventory.receive"],
      returns: ["returns.create", "sales.view"],
      coupons: ["sales.create", "settings.manage"],
      "purchased-devices": ["devices.buy_used"],
      employees: ["employees.view", "employees.manage", "employees.permissions"],
      audit: ["audit.view"],
      "payment-methods": ["sales.create"],
      settings: ["sales.create", "settings.manage"],
      permissions: ["employees.permissions"],
    };
    // Require membership even when there are no changes. Never return costs or profits.
    const context = await this.db.context(req.actor);
    if (context.store?.id !== store)
      throw new ForbiddenException(
        "This account is connected to another shop.",
      );
    const boundary = (await this.db.query<{
      head:string;first:string;
      changes:{revision:string;resource:string;id:string;operation:string;own:boolean}[];
    }>(`with boundary as (
      select coalesce((select revision from app_private.sync_heads where store_id=$1),0) head,
             coalesce((select min(revision) from app_private.sync_changes where store_id=$1),0) first
    ) select head::text,first::text,coalesce((select jsonb_agg(page order by page.revision::bigint) from (
      select c.revision::text,c.resource,c.entity_id id,c.operation,false own
      from app_private.sync_changes c where c.store_id=$1 and c.revision>$2::bigint
        and c.revision<=boundary.head and not $3::boolean order by c.revision limit 200
    ) page),'[]'::jsonb) changes from boundary`,[store,after,bootstrap==='1'])).rows[0];
    const resetRequired=bootstrap==='1'||BigInt(after)>BigInt(boundary.head)||
      (BigInt(boundary.head)>BigInt(after)&&BigInt(boundary.first)>BigInt(after)+1n);
    const rows=resetRequired?[]:boundary.changes;
    const granted=new Set<string>(Array.isArray(context.permissions)?context.permissions:[]);
    const allowed=new Set(Object.entries(permissions).filter(([,keys])=>keys.some(key=>granted.has(key))).map(([resource])=>resource));
    // The runtime login has no direct public-table SELECT. Evaluate own-shift
    // visibility through the same transaction-local identity/RLS as normal reads.
    const shiftIds=rows.filter(row=>row.resource==='shifts').map(row=>row.id);
    const ownShifts=new Set<string>(!allowed.has('shifts')&&shiftIds.length?await this.db.asActor(req.actor,async db=>(await db.query('select id::text from public.shifts where store_id=$1 and employee_id=$2 and id::text=any($3::text[])',[store,context.profile.id,shiftIds])).rows.map(row=>row.id)):[]);
    return {
      cursor: resetRequired?boundary.head:rows.at(-1)?.revision ?? after,
      hasMore: rows.length === 200,
      resetRequired,
      changes: rows.filter(row=>allowed.has(row.resource)||
        (['permissions','employees'].includes(row.resource)&&row.id===context.profile.id)||
        (row.resource==='shifts'&&ownShifts.has(row.id))).map(({revision,resource,id,operation})=>({revision,resource,id,operation})),
    };
  }
  @Post("offline-grant") async grant(
    @Req() req: AuthRequest,
    @Param("storeId") store: string,
    @Body() body: { terminalId: string },
  ) {
    uuid(store);
    uuid(body.terminalId);
    const context = await this.db.context(req.actor);
    if (
      context.store?.id !== store ||
      !(await this.db.permission(req.actor, "sales.create", store)) ||
      context.terminal
    )
      throw new ForbiddenException(
        "Sign in to your staff account online before enabling offline cash sales.",
      );
    const issuedAt = new Date().toISOString(),
      expiresAt = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
    const token = jwt.sign(
      {
        storeId: store,
        terminalId: body.terminalId,
        profileId: context.profile.id,
        issuedAt,
        expiresAt,
      },
      this.config.secret,
      {
        expiresIn: "8h",
        algorithm: "HS256",
        issuer: "taha-pos",
        audience: "taha-offline-cash",
      },
    );
    await this.db.query('select app_private.register_offline_lease($1,$2,$3,$4)',[store,body.terminalId,context.profile.id,expiresAt]);
    return { token, context, issuedAt, expiresAt, terminalId: body.terminalId };
  }
  @Post("sales") importSale(@Req() req:AuthRequest,@Param("storeId") store:string,@Body() body:CashCaptureInput){return this.cash.import(req.actor,store,body);}
  @Post("cash-captures") async capture(@Req() req:AuthRequest,@Param("storeId") store:string,@Body() body:CashCaptureInput){const {id}=await this.cash.register(req.actor,store,body);return {id};}
  @Get("exceptions") exceptions(@Req() req:AuthRequest,@Param("storeId") store:string,@Query('ids') ids=''){return this.cash.list(req.actor,uuid(store),ids.split(',').filter(Boolean));}
  @Get("cash-summary") cashSummary(@Req() req:AuthRequest,@Param("storeId") store:string){return this.cash.summary(req.actor,uuid(store));}
  @Post("exceptions/:id/resolve") resolve(@Req() req:AuthRequest,@Param("storeId") store:string,@Param("id") id:string,@Body() body:{action:string;reason:string;cashReturned?:number}){return this.cash.resolve(req.actor,uuid(store),uuid(id),body);}
}
