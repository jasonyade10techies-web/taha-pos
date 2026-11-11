import {useState} from "react";
import {Monitor} from "lucide-react";
import {remoteDisplay,type DisplayConnection} from "../../lib/api/customer-display";
import {useRepository,useAction} from "../../hooks/use-repository";
import {useUiStore} from "../../stores/ui-store";
import {useDisplayStore} from "../../stores/display-store";
import {Dialog} from "../ui/dialog";
import {Button} from "../ui/button";
import {ConfirmDialog,QueryState} from "../ui/workspace";

export function DisplayConnectionsDialog({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}) {
  const terminal=useUiStore(s=>s.terminalId);
  const query=useRepository("paired-customer-displays-"+terminal,()=>remoteDisplay.list(terminal),open);
  const [selected,setSelected]=useState<DisplayConnection|null>(null),action=useAction();
  return <><Dialog open={open} onOpenChange={onOpenChange} title="Customer Display Connections" description="These screens are paired to your current counter session.">
    <QueryState pending={query.isPending} error={query.isError} retry={()=>void query.refetch()}>
      <div className="device-session-list">{query.data?.length ? query.data.map(display=><article className="device-session-card" key={display.id}><Monitor size={22}/><div><strong>Customer Display</strong><p>{display.online ? "Connected" : "Waiting for display"}</p></div><Button size="small" disabled={action.busy} onClick={()=>setSelected(display)}>Disconnect</Button></article>) : <p>No customer displays paired. Use Connect Display to pair another screen.</p>}</div>
    </QueryState><div className="dialog-actions"><Button onClick={()=>void query.refetch()}>Refresh Connections</Button></div>{action.error && <p role="alert" className="text-danger">{action.error}</p>}
  </Dialog><ConfirmDialog open={!!selected} title="Disconnect customer display?" description="The screen will return to idle and require a new pairing code. Your current sale stays open." confirm="Disconnect Display" onClose={()=>setSelected(null)} busy={action.busy} onConfirm={()=>void action.run(()=>remoteDisplay.disconnect(selected!.displaySessionId || selected!.id!),"Customer display disconnected",()=>{setSelected(null);useDisplayStore.setState({connected:false});void query.refetch();})}/></>;
}
