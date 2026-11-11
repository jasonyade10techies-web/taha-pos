import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import baseConfig from "../vite.config";

/** Only the explicitly started LAN test preview serves the sideload APK. */
export default defineConfig(async environment=>{
  const base=await (typeof baseConfig==="function" ? baseConfig(environment) : baseConfig);
  return {...base,plugins:[...(base.plugins??[]),{
    name:"taha-staff-test-download",
    configureServer(server){
      server.middlewares.use(async(request,response,next)=>{
        const route=new URL(request.url??"/","http://local.test").pathname;
        if(!["/staff-test.apk","/staff-test-4c1.apk","/staff-test-4c2.apk","/staff-test-4c3.apk","/staff-test-4d0.apk","/staff-test-4e0.apk","/staff-test-5d0.apk","/staff-test-5d1.apk","/staff-test-5d2.apk"].includes(route))return next();
        if(!["GET","HEAD"].includes(request.method??"")){response.statusCode=405;response.end();return;}
        const filename=route==="/staff-test-5d1.apk"?"Taha-Staff-test-5D1.apk":route==="/staff-test-5d0.apk"?"Taha-Staff-test-5D0.apk":route==="/staff-test-4e0.apk"?"Taha-Staff-test-4E0.apk":route==="/staff-test-4d0.apk"?"Taha-Staff-test-4D0.apk":route==="/staff-test-4c3.apk"?"Taha-Staff-test-4C3.apk":route==="/staff-test-4c2.apk"?"Taha-Staff-test-4C2.apk":route==="/staff-test-4c1.apk"?"Taha-Staff-test-4C1.apk":"Taha-Staff-test-5D2.apk";
        const file=path.resolve("artifacts/android",filename);
        try {
          const info=await stat(file);if(!info.isFile())throw new Error("Missing APK");
          response.setHeader("Content-Type","application/vnd.android.package-archive");
          response.setHeader("Content-Disposition",`attachment; filename="${filename}"`);
          response.setHeader("Content-Length",info.size);response.setHeader("Cache-Control","no-store");
          if(request.method==="HEAD")response.end();else createReadStream(file).on("error",()=>response.destroy()).pipe(response);
        }catch{response.statusCode=404;response.end("Build the staff test APK before downloading.");}
      });
    },
  }]};
});

