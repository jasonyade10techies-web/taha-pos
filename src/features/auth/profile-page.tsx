import {MediaImage} from '../../components/media/media-image';
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { UserRound, ShieldCheck, KeyRound, Laptop, LogOut } from "lucide-react";
import { PageHeading } from "../../components/ui/page-heading";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { ImageUploader, ConfirmDialog } from "../../components/ui/workspace";
import { CameraCapture } from "../../components/camera/camera-capture";
import { useSessionStore } from "../../stores/session-store";
import { localDemoEnabled } from "../../lib/config";
import { repositories } from "../../lib/repositories";
import { profileService } from "./services/profile-service";
import { authService } from "./services/auth-service";
import { signOut } from "./session-actions";
import { friendlyError } from "../../lib/errors";
import { ConnectedDevices } from "./connected-devices";
import {bundledMobile} from "../../lib/mobile/runtime";

export function ProfilePage() {
  const location = useLocation(), navigate = useNavigate(), queryClient = useQueryClient();
  const { profile, employee, permissions, terminal, context } = useSessionStore();
  const [name, setName] = useState(profile?.full_name ?? ""), [phone, setPhone] = useState(profile?.phone ?? "");
  const [photo, setPhoto] = useState(profile?.avatar_url ?? ""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [storedPhoto, setStoredPhoto] = useState<string | undefined>();
  const [preparingPhoto,setPreparingPhoto] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false), [passwordOpen, setPasswordOpen] = useState(false), [logoutOpen, setLogoutOpen] = useState(false);
  useEffect(() => { if (location.hash === "#devices") setDevicesOpen(true); if (location.hash === "#password" && !localDemoEnabled && !terminal) setPasswordOpen(true); }, [location.hash, terminal]);
  const changeDevices = (open: boolean) => { setDevicesOpen(open); if (!open && location.hash === "#devices") navigate({ pathname: location.pathname, search: location.search, hash: "" }, { replace: true }); };
  const changePassword = (open: boolean) => { setPasswordOpen(open); if (!open && location.hash === "#password") navigate({ pathname: location.pathname, search: location.search, hash: "" }, { replace: true }); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (preparingPhoto) return; setBusy(true); setMessage("");
    try {
      if (localDemoEnabled) await repositories.employees.updateOwnProfile(name.trim(), phone.trim());
      else await profileService.updateOwnProfile(name.trim(), phone.trim());
      if (photo !== (profile?.avatar_url ?? "")) await profileService.updateOwnAvatar(photo, name.trim(), phone.trim(), storedPhoto);
      setMessage("Profile updated."); window.dispatchEvent(new Event("taha-session-refresh"));
    } catch (cause) { setMessage(friendlyError(cause, "Unable to update your profile.")); }
    finally { setBusy(false); }
  };
  const phonePhoto=async(preview:string,path:string)=>{setPhoto(preview);setStoredPhoto(path);setBusy(true);try{await profileService.updateOwnAvatar(preview,name.trim(),phone.trim(),path);setMessage("Profile picture updated.");window.dispatchEvent(new Event("taha-session-refresh"));}catch(cause){setMessage(friendlyError(cause,"Unable to save your profile picture. Retry Save profile."));}finally{setBusy(false);}};
  return <div className="profile-page"><PageHeading title="Your Profile" subtitle="Your identity and access at TAHA MOBILES."/>
    {bundledMobile&&<div className="staff-quick-actions"><Button onClick={()=>location.hash="/shop-connection"}>Shop Connection</Button><Button onClick={()=>location.hash="/diagnostics"}>Diagnostics</Button></div>}
    <section className="panel profile-panel"><div className="flex items-center gap-4 mb-6"><span className="avatar">{photo ? <MediaImage src={photo} alt="Profile photo" className="h-full w-full rounded-full object-cover"/> : employee.initials}</span><div><h2 className="text-lg font-semibold">{employee.name}</h2><p className="text-sm text-muted">{employee.role}</p><p className="text-xs text-muted">{context?.store?.branch_name}</p></div><UserRound size={22} className="ml-auto text-muted"/></div>
      {!terminal && <div className="profile-photo-actions"><strong>Profile picture</strong><ImageUploader value={photo} onChange={image => {setPhoto(image);setStoredPhoto(undefined);}} label="Upload profile photo" onBusyChange={setPreparingPhoto}/><CameraCapture type="profile-picture" title="Profile Picture" onImage={image => {setPhoto(image);setStoredPhoto(undefined);}} onStoredImage={({preview,path}) => {void phonePhoto(preview,path);}} compact/><small>Phone photos save automatically. Use Save profile for other changes.</small></div>}
      <form onSubmit={event => void submit(event)}><label className="field-label" htmlFor="profile-name">Full name</label><input className="input" id="profile-name" value={name} onChange={e => setName(e.target.value)} required maxLength={120} disabled={terminal || busy}/><label className="field-label mt-4" htmlFor="profile-phone">Phone</label><input className="input" id="profile-phone" value={phone} onChange={e => setPhone(e.target.value)} maxLength={32} disabled={terminal || busy}/><p className="text-sm text-muted mt-4">{profile?.email}</p><Button className="mt-5" variant="primary" type="submit" disabled={terminal || busy || preparingPhoto}>{busy ? "Saving…" : "Save profile"}</Button></form>
      <div className="auth-notice mt-6"><ShieldCheck size={18}/><p>{profile?.role === "owner" ? "Owner access includes all business permissions." : `${permissions.length} explicit permissions are assigned by management.`} {localDemoEnabled ? "Changes are saved to your local demo profile." : terminal ? "Profile changes require an individual staff sign-in." : "Roles and permissions are managed by the owner."}</p></div>{message && <p className="mt-4 text-sm" role="status">{message}</p>}
      <div className="profile-settings-grid">{!localDemoEnabled && !terminal && <div className="profile-setting-card"><KeyRound size={18}/><div><strong>Change password</strong><p>Update your sign-in password.</p></div><Button size="small" onClick={() => setPasswordOpen(true)}>Change</Button></div>}<div className="profile-setting-card"><Laptop size={18}/><div><strong>Connected devices</strong><p>Review account sessions.</p></div><Button size="small" onClick={() => setDevicesOpen(true)}>Manage</Button></div></div>
      <div className="profile-identifiers"><span>Employee ID: {profile?.id}</span><span>Status: {profile?.status}</span><Button onClick={() => setLogoutOpen(true)}><LogOut size={16}/>Sign Out</Button></div>
    </section><ConnectedDevices open={devicesOpen} onOpenChange={changeDevices}/><PasswordDialog open={passwordOpen} onOpenChange={changePassword}/><ConfirmDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} onConfirm={() => void signOut(queryClient)} title="Sign out of account?" description="Your counter session will close. Use Switch Employee to change the cashier without signing out." confirm="Sign Out"/>
  </div>;
}
function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [values, setValues] = useState({ current: "", next: "", confirm: "" }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const update = (key: keyof typeof values, value: string) => setValues(old => ({ ...old, [key]: value }));
  const change = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(""); try { await authService.changePassword(values.current, values.next); setValues({ current: "", next: "", confirm: "" }); onOpenChange(false); } catch (cause) { setError(friendlyError(cause, "Unable to change password.")); } finally { setBusy(false); } };
  return <Dialog open={open} onOpenChange={value => { if (!busy) { onOpenChange(value); if (!value) setValues({ current: "", next: "", confirm: "" }); } }} title="Change Password" description="Use a strong password you do not reuse elsewhere."><form onSubmit={e => void change(e)}><div className="form-grid">{(["current", "next", "confirm"] as const).map(key => <label className="form-field" key={key}>{key === "current" ? "Current Password" : key === "next" ? "New Password" : "Confirm New Password"}<input className="input" type="password" autoComplete={key === "current" ? "current-password" : "new-password"} value={values[key]} onChange={e => update(key, e.target.value)} required/></label>)}</div><p className="password-requirements">{values.next.length >= 12 ? "✓" : "○"} At least 12 characters · {values.next === values.confirm && values.confirm ? "✓ Passwords match" : "Confirm your new password"}</p>{error && <p role="alert" className="text-danger">{error}</p>}<div className="dialog-actions"><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy || !values.current || values.next.length < 12 || values.next !== values.confirm}>{busy ? "Saving…" : "Save Password"}</Button></div></form></Dialog>;
}
