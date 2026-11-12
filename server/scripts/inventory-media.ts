import 'dotenv/config';
import {configuration} from '../src/config';
import {Database} from '../src/database/database.service';
import {LocalFileStorage} from '../src/media/file-storage';

/** Read-only, bounded inventory. Never removes metadata or fabricates bytes. */
async function inventory(){
 if(process.env.TAHA_MEDIA_INVENTORY_APPROVED!=='true')throw Error('Explicit private media inventory approval is required.');
 const store=process.env.TAHA_MEDIA_INVENTORY_STORE;
 if(!store||!/^[0-9a-f-]{36}$/i.test(store))throw Error('Supply one explicitly approved store UUID.');
 const config=configuration(),db=new Database(config),files=new LocalFileStorage(config);
 try{
  const rows=(await db.query<{id:string;kind:string;path:string}>('select id,kind,path from app_private.media where store_id=$1 and deleted_at is null order by id limit 501',[store])).rows;
  if(rows.length>500)throw Error('More than 500 records: use a separately reviewed paged inventory rather than an unbounded provider scan.');
  const result=[];for(const row of rows){const key=(['product','device'].includes(row.kind)?'product-images/':'business-assets/')+row.path;
   result.push({id:row.id,kind:row.kind,display:await files.objectStatus(key),original:await files.objectStatus(key+'.original'),thumbnail:await files.objectStatus(key+'.thumb.webp')});
  }
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),readOnly:true,records:result.length,affected:result.filter(row=>row.display!=='present'||row.original!=='present'||row.thumbnail!=='present')},null,2));
 }finally{files.onModuleDestroy();await db.onModuleDestroy();}
}
if(require.main===module)inventory().catch(()=>{console.error('Private media inventory did not complete. No records or originals were changed.');process.exitCode=1;});
