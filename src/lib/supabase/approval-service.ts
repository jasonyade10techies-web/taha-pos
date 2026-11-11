import {apiEnabled} from "../config";
import {read,write} from "../api/catalog-repositories";
import type {PinVerification,CounterEmployee} from "../../types/auth";
import {activeStore,rpc} from "./repository-utils";
import {json} from "./transaction-repositories";
export const transactionApprovalService = {
  list: (permission:string)=>apiEnabled ? read<CounterEmployee[]>(`/approvals?permission=${encodeURIComponent(permission)}`) : rpc("list_transaction_approvers",{p_store_id:activeStore(),p_permission:permission}),
  async approve(managerId:string,pin:string,purpose:"price"|"payment"|"return",payload:unknown) {
    const result = apiEnabled ? await write<PinVerification & {expiresAt?:string;managerId?:string;managerName?:string}>("/approvals",{managerId,pin,purpose,payload}) : await rpc("approve_transaction",{p_store_id:activeStore(),p_manager_id:managerId,p_pin:pin,p_purpose:purpose,p_payload:json(payload)});
    if (!result.ok || !result.token) throw new Error(result.message ?? "Approval could not be verified.");
    return result;
  },
};
