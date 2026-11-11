import type { PosProduct } from '../../types/product';
import type { MaterialLocation } from '../../lib/repositories/interfaces';
export function ServiceMaterialAllocation({product,quantity,onQuantity,locations,values,onAllocation}:{product:PosProduct;quantity:number;onQuantity:(n:number)=>void;locations:MaterialLocation[];values:Record<string,number>;onAllocation:(id:string,n:number)=>void}) {
  return <div className="service-allocation"><p>{product.compatibleModel} · {[product.qualityGrade,product.color].filter(Boolean).join(' · ')}</p>
    <label>Material quantity<input className="input" aria-label="Material quantity" type="number" inputMode="numeric" min={1} max={999999} step={1} value={quantity} onChange={e=>onQuantity(Number(e.target.value))}/></label>
    {locations.length>1&&<><p>Allocate {quantity} unit{quantity===1?'':'s'} from the correct locations.</p>{locations.map(place=><label key={place.locationId} className="service-location-row"><span>{place.path??place.locationId}<small>{place.quantity} available</small></span><input className="input" type="number" inputMode="numeric" min={0} max={place.quantity} step={1} aria-label={'Allocate from '+(place.path??place.locationId)} value={values[place.locationId]??0} onChange={e=>onAllocation(place.locationId,Number(e.target.value))}/></label>)}</>}
  </div>;
}
