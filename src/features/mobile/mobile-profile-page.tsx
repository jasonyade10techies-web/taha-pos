import {useShopConfiguration} from "../../hooks/use-shop-configuration";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Pencil,
  Camera,
  ImagePlus,
  Trash2,
  KeyRound,
  Smartphone,
  ChevronRight,
  LogOut,
  Shield,
  UserRound,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { SheetSelect } from "../../components/ui/sheet-select";
import { CropEditor } from "../../components/media/crop-editor";
import { MediaImage } from "../../components/media/media-image";
import { useSessionStore } from "../../stores/session-store";
import { useUiStore } from "../../stores/ui-store";
import {
  staffService,
  requireMobileOnline,
  staffStorePath,
} from "../../lib/mobile/staff-service";
import { apiAuth, apiRequest } from "../../lib/api/client";
import { apiStoreMedia } from "../../lib/api/media";
import { prepareImage } from "../../lib/media";
import { useAction } from "../../hooks/use-repository";
import { useMobilePreferences } from "../../stores/mobile-preferences-store";
export function MobileProfilePage() {
  const {ownerOnly}=useShopConfiguration();
  const session = useSessionStore(),
    ui = useUiStore(),
    action = useAction(),
    navigate = useNavigate(),
    camera = useRef<HTMLInputElement>(null),
    gallery = useRef<HTMLInputElement>(null);
  const [cropPhoto, setCropPhoto] = useState<string | null>(null),
    [photo, setPhoto] = useState(false),
    [edit, setEdit] = useState(false),
    [password, setPassword] = useState(false),
    [name, setName] = useState(session.profile?.full_name || ""),
    [phone, setPhone] = useState(session.profile?.phone || ""),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState("");
  const choosePhoto = (file: File, captured = false) =>
    void action.run(async () => {
      const data = await prepareImage(file, { longEdge: 1800 });
      if (captured && useMobilePreferences.getState().saveToGallery)
        window.TahaNative?.saveToGallery?.(data);
      setPhoto(false);
      setCropPhoto(data);
    }, "");
  const savePhoto = (data = "") =>
    void action.run(
      async () => {
        requireMobileOnline();
        const path = await apiStoreMedia(data, "profile");
        await apiRequest(staffStorePath() + "/profile", {
          method: "PATCH",
          body: JSON.stringify({
            fullName: session.profile?.full_name,
            phone: session.profile?.phone || "",
            avatarPath: path,
          }),
        });
        setPhoto(false);
        setCropPhoto(null);
        window.dispatchEvent(new Event("taha-session-refresh"));
      },
      data ? "Profile picture updated" : "Profile picture removed",
    );
  const avatar = session.profile?.avatar_url;
  return (
    <div className="staff-page staff-profile">
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => {
          if (e.target.files?.[0]) choosePhoto(e.target.files[0], true);
          e.target.value = "";
        }}
      />
      <input
        ref={gallery}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) choosePhoto(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <div className="staff-profile-hero">
        <div className="staff-profile-photo">
          {avatar ? (
            <MediaImage
              src={avatar.startsWith("http") ? avatar : "taha-media:" + avatar}
              alt="Your profile"
            />
          ) : (
            <UserRound size={42} />
          )}
          <button
            aria-label="Change profile picture"
            onClick={() => setPhoto(true)}
          >
            <Pencil size={16} />
          </button>
        </div>
        <h1>{session.profile?.full_name}</h1>
        <p>
          {session.profile?.role} ·{" "}
          {session.context?.store?.branch_name || "Main Branch"}
        </p>
        <span className="staff-status">Active</span>
      </div>
      <section className="staff-section">
        <h2>Personal Details</h2>
        <article className="panel staff-detail-list">
          <div>
            <span>Email</span>
            <strong>{session.profile?.email}</strong>
          </div>
          <div>
            <span>Phone</span>
            <strong>{session.profile?.phone || "Not added"}</strong>
          </div>
          <div>
            <span>Employee ID</span>
            <strong>{session.profile?.id.slice(0, 8).toUpperCase()}</strong>
          </div>
          <Button variant="ghost" onClick={() => setEdit(true)}>
            <Pencil size={16} />
            Edit Profile
          </Button>
        </article>
      </section>
      <section className="staff-section">
        <h2>Account</h2>
        <div className="panel staff-settings-list">
          <button onClick={() => setPassword(true)}>
            <KeyRound size={20} />
            <span>Change Password</span>
            <ChevronRight size={18} />
          </button>
          <button onClick={() => navigate("/mobile/devices")}>
            <Smartphone size={20} />
            <span>Connected Devices</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <section className="staff-section">
        <h2>Appearance</h2>
        <SheetSelect
          label="Theme"
          value={ui.theme}
          options={["light", "dark", "system"].map((v) => ({
            value: v,
            label: v[0].toUpperCase() + v.slice(1),
          }))}
          onChange={(v) => ui.setTheme(v as typeof ui.theme)}
        />
      </section>
      <section className="staff-section">
        <h2>Security</h2>
        <div className="panel staff-settings-list">
          {!ownerOnly&&<button
            onClick={() => {
              window.dispatchEvent(new Event("taha-mobile-switch"));
            }}
          >
            <Shield size={20} />
            <span>Switch Employee</span>
            <ChevronRight size={18} />
          </button>}
          <button
            className="text-danger"
            onClick={() =>
              window.dispatchEvent(new Event("taha-mobile-logout"))
            }
          >
            <LogOut size={20} />
            <span>Sign Out</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      {!useMobilePreferences((s) => s.verifiedSession) && (
        <p className="staff-cache-label">
          Saved profile · Reconnect before editing your account.
        </p>
      )}
      {action.error && (
        <p role="alert" className="text-danger">
          {action.error}
        </p>
      )}
      <CropEditor
        image={cropPhoto}
        onClose={() => setCropPhoto(null)}
        onApply={(data) => savePhoto(data)}
      />
      <Dialog
        open={photo}
        onOpenChange={setPhoto}
        title="Profile Picture"
        className="bottom-sheet"
      >
        <div className="staff-settings-list">
          <button
            disabled={action.busy}
            onClick={() => camera.current?.click()}
          >
            <Camera />
            <span>Take Photo with Phone</span>
          </button>
          <button
            disabled={action.busy}
            onClick={() => camera.current?.click()}
          >
            <Camera />
            <span>Use This Device</span>
          </button>
          <button
            disabled={action.busy}
            onClick={() => gallery.current?.click()}
          >
            <ImagePlus />
            <span>Choose Photo</span>
          </button>
          {avatar && (
            <button
              disabled={action.busy}
              className="text-danger"
              onClick={() => savePhoto()}
            >
              <Trash2 />
              <span>Remove Photo</span>
            </button>
          )}
          <Button onClick={() => setPhoto(false)}>Cancel</Button>
        </div>
      </Dialog>
      <Dialog
        open={edit}
        onOpenChange={setEdit}
        title="Edit Profile"
        className="bottom-sheet"
      >
        <form
          className="staff-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await staffService.updateProfile(name.trim(), phone.trim());
              setEdit(false);
              window.dispatchEvent(new Event("taha-session-refresh"));
            }, "Profile updated");
          }}
        >
          <label>
            Full Name
            <input
              className="input"
              value={name}
              maxLength={120}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              className="input"
              type="tel"
              value={phone}
              maxLength={32}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <Button type="submit" variant="primary" disabled={action.busy}>
            Save Profile
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={password}
        onOpenChange={(v) => {
          setPassword(v);
          if (!v) {
            setCurrent("");
            setNext("");
            setConfirm("");
          }
        }}
        title="Change Password"
        className="bottom-sheet"
      >
        <form
          className="staff-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              requireMobileOnline();
              await apiAuth.changePassword(current, next);
              setPassword(false);
              setCurrent("");
              setNext("");
              setConfirm("");
            }, "Password changed");
          }}
        >
          <label>
            Current Password
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </label>
          <label>
            New Password
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={12}
              required
            />
          </label>
          <p className="staff-cache-label">
            {next.length >= 12 ? "✓" : "○"} At least 12 characters · Use a
            unique password
          </p>
          <label>
            Confirm New Password
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          {confirm && confirm !== next && (
            <p className="text-danger">Passwords do not match.</p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={
              action.busy || next !== confirm || !current || next.length < 12
            }
          >
            Change Password
          </Button>
          {action.error && (
            <p role="alert" className="text-danger">
              {action.error}
            </p>
          )}
        </form>
      </Dialog>
    </div>
  );
}
