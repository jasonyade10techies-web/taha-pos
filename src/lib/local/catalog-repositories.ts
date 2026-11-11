import { demoDb, atomic, newId, nextCode, requireValue, money } from "./database";
import { authorize, allowed, audit, move, amount, editable, actor } from "./common";
import type {
  ProductRepository,
  LocationRepository,
  InventoryRepository,
  ServiceRepository,
} from "../repositories/interfaces";
import type { PosProduct } from "../../types/product";
import type { DemoProduct, ProductInput, Location } from "../../types/demo";
import { serviceNameKey } from '../smart-services';
import {inventoryConditions,damagedInventory,conditionLocations,damageAction} from './inventory-conditions';

async function locationParts(id: string) {
  const box = await demoDb.locations.get(id);
  const shelf = box ? await demoDb.locations.get(box.parentId) : undefined;
  const rack = shelf ? await demoDb.locations.get(shelf.parentId) : undefined;
  return box && shelf && rack
    ? {
        rack: rack.name.replace(/^Rack\s+/i, ""),
        shelf: shelf.name.replace(/^Shelf\s+/i, ""),
        box: box.name.replace(/^Box\s+/i, ""),
      }
    : null;
}
async function recordDamagedIntake(product:DemoProduct,locationId:string,quantity:number,reason:string) {
  const id=newId(),employee=actor(),createdAt=new Date().toISOString();
  await demoDb.damagedLots.add({id,productId:product.id,productName:product.name,quantity,locationId,locationPath:await new LocalLocationRepository().path(locationId),employeeId:employee.id,employeeName:employee.name,reason,createdAt,disposition:'Damaged',invoice:reason.startsWith('Damaged opening')?'Opening inventory':'Stock receipt'});
  await demoDb.conditionMovements.add({id:newId(),lotId:id,productId:product.id,locationId,quantity,action:'RETURN_DAMAGED',employeeId:employee.id,createdAt,notes:reason});
  await audit('stock.damaged_received','Inventory',`${quantity} ${product.name}: ${reason}`,id);
}
export class LocalProductRepository implements ProductRepository {
  async saveValue(kind:string,value:string) {
    authorize(allowed("products.create")?"products.create":"products.edit");
    value=value.trim().replace(/\s+/g," ");
    requireValue(["category","brand","model","grade","color"].includes(kind)&&value.length>0&&value.length<=120,"Enter a valid catalogue value.");
    return atomic(async()=>{
      const normalized=value.toLocaleLowerCase("en"),previous=await demoDb.catalogValues.where("[kind+normalized]").equals([kind,normalized]).first();
      if(previous)return previous;
      const saved={id:crypto.randomUUID(),kind,value,normalized};await demoDb.catalogValues.add(saved);
      await audit("catalogue.value_created","Inventory",`${kind}: ${value}`,saved.id);return saved;
    });
  }
  async values() {
    const products = await this.list();
    const fields = {
      category: "category",
      brand: "brand",
      compatibleModel: "model",
      qualityGrade: "grade",
      color: "color",
    } as const;
    return [...await demoDb.catalogValues.toArray(),...Object.entries(fields).flatMap(([key, kind]) =>
      [
        ...new Set(
          products
            .map((p) => String(p[key as keyof typeof fields]))
            .filter(Boolean),
        ),
      ].map((value) => ({ kind, value })),
    )];
  }
  list = () => demoDb.products.toArray();
  get = (id: string) => demoDb.products.get(id);
  async pos(): Promise<PosProduct[]> {
    const products = await demoDb.products
      .where("state")
      .equals("active")
      .toArray();
    products.sort((a, b) => a.internalCode.localeCompare(b.internalCode));
    const balances = await demoDb.balances.toArray();
    const damageEvents = await demoDb.conditionMovements.toArray();
    const result: PosProduct[] = await Promise.all(
      products.map(async (p) => {
        const stock = balances.filter((b) => b.productId === p.id);
        const primary = stock
          .filter((b) => b.quantity > 0)
          .sort((a, b) => b.quantity - a.quantity)[0];
        return {
          id: p.id,
          internalCode: p.internalCode,
          name: p.name,
          category: p.category,
          brand: p.brand,
          compatibleModel: p.compatibleModel,
          qualityGrade: p.qualityGrade,
          color: p.color,
          quantity: stock.reduce((sum, b) => sum + b.quantity, 0),
          damagedQuantity: damageEvents.filter(event=>event.productId===p.id).reduce((sum,event)=>sum+event.quantity,0),
          sellingPrice: p.sellingPrice,
          minimumSellingPrice: p.minimumSellingPrice,
          location: await locationParts(primary?.locationId ?? p.locationId),
          aliases: p.aliases,
          lowStockLevel: p.lowStockLevel,
          image: p.image,
        };
      }),
    );
    const services = await demoDb.services.toArray();
    return [
      ...result,
      ...services
        .filter((s) => s.active)
        .map((s) => ({
          id: s.id,
          internalCode: s.code,
          name: s.name,
          category: "Services" as const,
          brand: "TAHA MOBILES",
          compatibleModel: "All phone models",
          qualityGrade: "Service",
          color: "",
          quantity: 999999,
          sellingPrice: s.sellingPrice,
          minimumSellingPrice: s.minimumSellingPrice,
          location: null,
          aliases: [s.category, s.notes],
          lowStockLevel: 0,
        })),
    ];
  }
  async cost(id: string) {
    return allowed("costs.view_purchase_cost")
      ? ((await demoDb.financials.get(id))?.cost ?? null)
      : null;
  }
  async save(input: ProductInput) {
    authorize(input.id ? "products.edit" : "products.create");
    requireValue(input.name.trim(), "Product name is required.");
    amount(input.sellingPrice);
    amount(input.minimumSellingPrice);
    requireValue(
      input.minimumSellingPrice <= input.sellingPrice,
      "Minimum price cannot exceed selling price.",
    );
    requireValue(
      Number.isInteger(input.initialQuantity) && input.initialQuantity >= 0,
      "Initial stock must be a whole quantity.",
    );
    requireValue(input.lowStockLevel >= 0, "Reorder level cannot be negative.");
    return atomic(async () => {
      const old = input.id ? await this.get(input.id) : undefined;
      requireValue(!input.id || old, "Product no longer exists.");
      const location = await demoDb.locations.get(input.locationId);
      requireValue(
        (!input.locationId && input.initialQuantity===0) || (location?.kind === "box" && !location.archived),
        "Select an active box location.",
      );
      const { purchaseCost, initialQuantity, ...fields } = input;
      const product: DemoProduct = {
        ...fields,
        sellingPrice: amount(input.sellingPrice),
        minimumSellingPrice: amount(input.minimumSellingPrice),
        id: old?.id ?? newId(),
        internalCode: old?.internalCode ?? (await nextCode("TM-P-")),
        createdAt: old?.createdAt ?? new Date().toISOString(),
      };
      await demoDb.products.put(product);
      if (purchaseCost !== undefined) {
        authorize("costs.view_purchase_cost");
        await demoDb.financials.put({
          id: product.id,
          cost: amount(purchaseCost, "Purchase cost"),
        });
      }
      if (!old && initialQuantity > 0) {
        const condition=input.initialCondition??"Available";
        requireValue((location?.stockCondition??"Available")===condition,"Choose a location matching this stock condition.");
        if(condition==='Damaged')await recordDamagedIntake(product,input.locationId,initialQuantity,"Damaged opening inventory");
        else await move(
          product.id,
          input.locationId,
          initialQuantity,
          "RECEIVE",
          product.internalCode,
          "Initial stock",
        );
      }
      await audit(
        old ? "product.edited" : "product.created",
        "Inventory",
        `${product.name} ${old ? "updated" : "added"}`,
        product.internalCode,
      );
      return product;
    });
  }
  async duplicate(id: string) {
    const p = await this.get(id);
    requireValue(p, "Product not found.");
    const cost = await this.cost(id);
    return this.save({
      ...p,
      id: undefined,
      name: `${p.name} · Copy`,
      state: "active",
      initialQuantity: 0,
      ...(cost === null ? {} : { purchaseCost: cost }),
    });
  }
  async archive(id: string) {
    authorize("products.archive");
    await atomic(async () => {
      await demoDb.products.update(id, { state: "archived" });
      await audit("product.archived", "Inventory", "Product archived", id);
    });
  }
}
export class LocalLocationRepository implements LocationRepository {
  list = () => demoDb.locations.toArray();
  get = (id: string) => demoDb.locations.get(id);
  balances = () => demoDb.balances.toArray();
  async path(id: string) {
    const parts: string[] = [];
    let location = await this.get(id);
    while (location) {
      parts.unshift(location.name);
      location = location.parentId
        ? await this.get(location.parentId)
        : undefined;
    }
    return parts.join(" → ");
  }
  async save(value: Location) {
    authorize("inventory.adjust");
    requireValue(value.name.trim(), "A location name is required.");
    return atomic(async () => {
      const old = await this.get(value.id);
      requireValue(value.kind==='box'||value.stockCondition!=='Damaged','Only boxes can be designated Damaged / Quarantine.');
      if(old&&(old.stockCondition??'Available')!==(value.stockCondition??'Available')) {
        const balances=await demoDb.balances.where('locationId').equals(value.id).toArray();
        const damaged=(await demoDb.conditionMovements.where('locationId').equals(value.id).toArray()).reduce((sum,m)=>sum+m.quantity,0);
        requireValue(!balances.some(b=>b.quantity!==0)&&damaged===0,'Move all tracked stock before changing a box condition.');
      }
      if (value.kind !== "rack") {
        const parent = await this.get(value.parentId);
        requireValue(
          parent &&
            !parent.archived &&
            parent.kind === (value.kind === "shelf" ? "rack" : "shelf"),
          "Locations must follow Rack → Shelf → Box.",
        );
      } else requireValue(!value.parentId, "Racks cannot have a parent.");
      if (old)
        requireValue(
          old.kind === value.kind && old.parentId === value.parentId,
          "Location hierarchy is permanent. Use stock transfers to move products.",
        );
      const record = { ...value, code: old?.code ?? (await nextCode("TM-L-")) };
      await demoDb.locations.put(record);
      await audit(
        "location.saved",
        "Inventory",
        `${record.name} ${old ? "renamed" : "created"}`,
        record.code,
      );
      return record;
    });
  }
  async archive(id: string) {
    authorize("inventory.adjust");
    await atomic(async () => {
      const children = await demoDb.locations
        .where("parentId")
        .equals(id)
        .toArray();
      requireValue(
        !children.some((c) => !c.archived),
        "Archive empty child locations first.",
      );
      const balances = await demoDb.balances
        .where("locationId")
        .equals(id)
        .toArray();
      requireValue(
        !balances.some((b) => b.quantity !== 0),
        "Only empty locations can be archived.",
      );
      requireValue((await demoDb.conditionMovements.where('locationId').equals(id).toArray()).reduce((sum,m)=>sum+m.quantity,0)===0,'Move all damaged stock before archiving this location.');
      const tests = await demoDb.testOuts
        .where("status")
        .equals("OUT")
        .toArray();
      requireValue(
        !tests.some((t) => t.locationId === id),
        "This location has items out for testing.",
      );
      await demoDb.locations.update(id, { archived: true });
      await audit(
        "location.archived",
        "Inventory",
        "Empty location archived",
        id,
      );
    });
  }
}
export class LocalInventoryRepository implements InventoryRepository {
  conditions=inventoryConditions;
  damaged=damagedInventory;
  conditionLocations=conditionLocations;
  damageAction=damageAction;
  async adjust(
    productId: string,
    locationId: string,
    expected: number,
    quantity: number,
    reason: string,
  ) {
    authorize("inventory.adjust");
    requireValue(
      Number.isInteger(quantity) && quantity >= 0,
      "Enter a nonnegative whole quantity.",
    );
    requireValue(
      [
        "Opening Stock",
        "Physical Count",
        "Damaged",
        "Missing",
        "Correction",
        "Other",
      ].includes(reason),
      "Select a reason.",
    );
    await atomic(async () => {
      const current =
        (await demoDb.balances.get(`${productId}:${locationId}`))?.quantity ??
        0;
      requireValue(
        current === expected,
        "Stock changed; reload before adjusting.",
      );
      requireValue(current !== quantity, "Quantity is unchanged.");
      await move(
        productId,
        locationId,
        quantity - current,
        "ADJUSTMENT",
        newId(),
        reason,
      );
      await audit(
        "stock.adjusted",
        "Inventory",
        `${reason}: ${current} → ${quantity}`,
        productId,
      );
    });
  }
  balances = () => demoDb.balances.toArray();
  movements = () => demoDb.movements.orderBy("createdAt").reverse().toArray();
  drafts = () => demoDb.drafts.toArray();
  async saveDraft(draft: import("../../types/demo").ReceiveDraft) {
    authorize("inventory.receive");
    await atomic(async () => {
      requireValue(
        (await demoDb.drafts.get(draft.id))?.status !== "Received",
        "Received documents cannot be edited.",
      );
      await demoDb.drafts.put({ ...draft, status: "Draft" });
      await audit(
        "stock.draft_saved",
        "Inventory",
        "Stock receiving draft saved",
        draft.reference,
      );
    });
  }
  async receive(draft: import("../../types/demo").ReceiveDraft) {
    authorize("inventory.receive");
    requireValue(draft.lines.length, "Add at least one product.");
    await atomic(async () => {
      requireValue(
        (await demoDb.drafts.get(draft.id))?.status !== "Received",
        "This receipt has already been received.",
      );
      requireValue(
        await demoDb.suppliers.get(draft.supplierId),
        "Select a supplier.",
      );
      for (const line of draft.lines) {
        const product = await demoDb.products.get(line.productId);
        requireValue(
          product?.state === "active" && !['services','service','phones','used phones'].includes(product.category.toLowerCase().trim()),
          "Select an active stock product.",
        );
        requireValue(
          line.quantity > 0 && Number.isInteger(line.quantity),
          "Received quantities must be positive whole numbers.",
        );
        const location=await demoDb.locations.get(line.locationId),condition=line.condition??'Available';
        requireValue(location?.kind==='box'&&!location.archived&&(location.stockCondition??'Available')===condition,'Choose an active destination matching the stock condition.');
        if(condition==='Damaged')await recordDamagedIntake(product,line.locationId,line.quantity,'Damaged stock received · '+(draft.reference||draft.id));
        else await move(
          line.productId,
          line.locationId,
          line.quantity,
          "RECEIVE",
          draft.reference || draft.id,
        );
        if(line.cost!==undefined)await demoDb.financials.put({
          id: line.productId,
          cost: amount(line.cost, "Purchase cost"),
        });
      }
      await demoDb.drafts.put({ ...draft, status: "Received" });
      await audit(
        "stock.received",
        "Inventory",
        `${draft.lines.reduce((sum, l) => sum + l.quantity, 0)} units received`,
        draft.reference,
      );
    });
  }
  async transfer(
    productId: string,
    source: string,
    destination: string,
    quantity: number,
  ) {
    authorize("inventory.transfer");
    requireValue(source !== destination, "Choose a different destination.");
    requireValue(
      Number.isInteger(quantity) && quantity > 0,
      "Enter a positive whole quantity.",
    );
    await atomic(async () => {
      requireValue(
        ((await demoDb.balances.get(`${productId}:${source}`))?.quantity ??
          0) >= quantity,
        "Cannot transfer more than available stock.",
      );
      const ref = newId();
      await move(productId, source, -quantity, "TRANSFER_OUT", ref);
      await move(productId, destination, quantity, "TRANSFER_IN", ref);
      await audit(
        "stock.transferred",
        "Inventory",
        `${quantity} units transferred between locations`,
        ref,
      );
    });
  }
}
const serviceEditor = editable(
  demoDb.services,
  "Services",
  "repair.services.manage",
  (s) => {
    requireValue(s.name.trim(), "Service name is required.");
    amount(s.sellingPrice);
    requireValue(
      s.minimumSellingPrice >= 0 && s.minimumSellingPrice <= s.sellingPrice,
      "Invalid minimum price.",
    );
  },
  "TM-S-",
);
export const localServices: ServiceRepository = {
  ...serviceEditor,
  async list(){return Promise.all((await demoDb.services.toArray()).map(currentServiceTemplate));},
  async get(id){const service=await demoDb.services.get(id);return service?currentServiceTemplate(service):undefined;},
  async save(value) {
    const prior=await demoDb.services.get(value.id);
    const unlink=Object.prototype.hasOwnProperty.call(value,'linkedProductId')&&value.linkedProductId===null;
    value={...prior,...value};
    if(unlink)value={...value,defaultLaborCharge:undefined,pricingRule:undefined};
    authorize(prior ? 'repair.services.manage' : allowed('repair.services.manage') ? 'repair.services.manage' : 'services.save_catalog');
    requireValue(value.name.trim(),'Service name is required.');
    amount(value.sellingPrice); amount(value.minimumSellingPrice);
    requireValue(value.minimumSellingPrice<=value.sellingPrice,'Minimum price cannot exceed the default charge.');
    if(value.linkedProductId){
      const part=await demoDb.products.get(value.linkedProductId);
      requireValue(part?.state==='active'&&part.category!=='Services','Review the template: select an active physical linked product.');
      requireValue(!(await demoDb.devices.where('productId').equals(part.id).count()),'A tracked device cannot be a template material.');
      amount(value.defaultLaborCharge??0);
      requireValue(!value.pricingRule||value.pricingRule==='current-product-plus-labor','Use current product price plus default labor.');
    }else requireValue(value.defaultLaborCharge===undefined&&value.pricingRule===undefined,'Select a linked product for this pricing rule.');
    return atomic(async()=>{
      const duplicate=(await demoDb.services.toArray()).find(s=>s.id!==value.id&&serviceNameKey(s.name)===serviceNameKey(value.name));
      if (duplicate) {
        requireValue(!prior,'Another saved service already has this name.');
        return currentServiceTemplate(duplicate);
      }
      const saved={...value,name:value.name.trim(),code:prior?.code||value.code||await nextCode('TM-S-'),createdBy:prior?.createdBy??actor().id,updatedBy:actor().id,...(value.linkedProductId?{defaultLaborCharge:value.defaultLaborCharge??0,pricingRule:'current-product-plus-labor' as const}:{})};
      await demoDb.services.put(saved);
      await audit('service.saved','Services','Reusable service saved',saved.id);
      return currentServiceTemplate(saved);
    });
  },
  async materialLocations(productId) {
    authorize('sales.create');authorize('services.consume_inventory');
    const product=await demoDb.products.get(productId);
    requireValue(product?.state==='active'&&product.category!=='Services','Choose an active physical part.');
    const locations=await demoDb.locations.toArray(), balances=await demoDb.balances.where('productId').equals(productId).toArray();
    const eligible=balances.filter(b=>b.quantity>0&&locations.some(l=>l.id===b.locationId&&!l.archived&&l.kind==='box'&&(l.stockCondition??'Available')==='Available'));
    return Promise.all(eligible.map(async b=>({...b,path:await new LocalLocationRepository().path(b.locationId)})));
  },
};

async function currentServiceTemplate(service:import('../../types/demo').RepairService){
  if(!service.linkedProductId)return service;
  const part=await demoDb.products.get(service.linkedProductId);
  const balances=await demoDb.balances.where('productId').equals(service.linkedProductId).toArray(),locations=await demoDb.locations.toArray();
  const available=balances.some(b=>b.quantity>0&&locations.some(l=>l.id===b.locationId&&!l.archived&&l.kind==='box'&&(l.stockCondition??'Available')==='Available'));
  return {...service,sellingPrice:money((part?.sellingPrice??0)+(service.defaultLaborCharge??0)),minimumSellingPrice:part?.minimumSellingPrice??0,requiresReview:part?.state!=='active'||!available};
}
