import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LockKeyhole, LogOut } from "lucide-react";
import { Logo } from "../../components/ui/logo";
import { Button } from "../../components/ui/button";
import { counterService } from "./services/counter-service";
import {
  mockAuthEnabled,
  localDemoEnabled,
  demoPinEnabled,
} from "../../lib/config";
import { repositories } from "../../lib/repositories";
import { useSessionStore, mockContext } from "../../stores/session-store";
import { clearWorkspace, signOut } from "./session-actions";
import { friendlyError } from "../../lib/errors";
import type { CounterEmployee } from "../../types/auth";
const demoEmployees: CounterEmployee[] = [
  { id: "demo-hamza", full_name: "Hamza", role: "employee", avatar_url: null },
  { id: "demo-ali", full_name: "Ali", role: "employee", avatar_url: null },
  { id: "demo-ahmed", full_name: "Ahmed", role: "owner", avatar_url: null },
];
export function CounterPage() {
  const status = useSessionStore((s) => s.authStatus);
  const terminal = useSessionStore((s) => s.terminal);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const local = useQuery({
    queryKey: ["local-counter"],
    queryFn: () => repositories.employees.list(),
    enabled: localDemoEnabled && status === "authenticated",
  });
  const [selected, setSelected] = useState<CounterEmployee | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, isError, isPending } = useQuery({
    queryKey: ["counter", "employees"],
    queryFn: counterService.employees,
    enabled: !mockAuthEnabled && status === "counter-locked",
    retry: false,
  });
  if (status === "anonymous" || status === "denied" || status === "error")
    return <Navigate to="/login" replace />;
  if (!mockAuthEnabled && status === "authenticated" && !terminal)
    return <Navigate to="/" replace />;
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || pin.length !== 6) return;
    if (localDemoEnabled) {
      if (!demoPinEnabled) {
        setError(
          "Demo PIN switching is disabled in production builds. Use the development Local Demo or configured Supabase counter.",
        );
        return;
      }
      if (pin !== "123456") {
        setError("Incorrect demo PIN. Use 123456 in this local prototype.");
        return;
      }
      clearWorkspace(queryClient);
      const employee = local.data?.find((e) => e.id === selected.id);
      if (employee)
        useSessionStore.getState().applyContext({
          ...mockContext,
          profile: employee,
          permissions: employee.permissions,
        });
      sessionStorage.setItem("taha-demo-employee", selected.id);
      window.dispatchEvent(new Event("taha-session-refresh"));
      navigate("/");
      return;
    }
    if (mockAuthEnabled) return;
    setBusy(true);
    setError("");
    try {
      const result = await counterService.verify(selected.id, pin);
      setPin("");
      if (result.ok) {
        clearWorkspace(queryClient);
        window.dispatchEvent(new Event("taha-session-refresh"));
      } else setError(result.message ?? "PIN verification failed. Try again.");
    } catch (cause) {
      setPin("");
      setError(
        friendlyError(
          cause,
          "Unable to verify your PIN. Check your connection.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  if (status === "authenticated" && terminal && !busy)
    return <Navigate to="/" replace />;
  const employees = localDemoEnabled
    ? (local.data?.filter((e) => e.status === "active") ?? [])
    : mockAuthEnabled
      ? demoEmployees
      : (data ?? []);
  return (
    <main className="auth-page">
      <div className="auth-top">
        <Logo />
        <span className="text-xs text-muted">Counter session</span>
      </div>
      <section className="auth-card counter-card panel">
        <span className="auth-symbol">
          <LockKeyhole size={25} />
        </span>
        <h1>Who’s working?</h1>
        <p className="auth-subtitle">
          Choose your profile and enter your six-digit PIN.
        </p>
        {selected ? (
          <form onSubmit={(event) => void verify(event)}>
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => {
                setSelected(null);
                setPin("");
                setError("");
              }}
            >
              <ArrowLeft size={16} />
              Choose another employee
            </Button>
            <h2 className="text-lg font-semibold mb-4">{selected.full_name}</h2>
            <label className="field-label" htmlFor="employee-pin">
              6-digit PIN
            </label>
            <input
              autoFocus
              className="input pin-input"
              id="employee-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{6}"
              maxLength={6}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, ""))
              }
              disabled={busy}
            />
            <Button
              variant="primary"
              className="auth-submit"
              type="submit"
              disabled={
                busy ||
                pin.length !== 6 ||
                (mockAuthEnabled && !localDemoEnabled)
              }
            >
              {busy ? "Verifying…" : "Start working"}
            </Button>
          </form>
        ) : (
          <div className="employee-picker">
            {employees.map((employee) => (
              <button
                key={employee.id}
                className="employee-card"
                onClick={() => setSelected(employee)}
              >
                <span className="avatar">{employee.full_name.slice(0, 1)}</span>
                <strong>{employee.full_name}</strong>
                <small>
                  {employee.role === "owner"
                    ? "Owner / Admin"
                    : employee.role === "manager"
                      ? "Manager"
                      : "Employee"}
                </small>
              </button>
            ))}
          </div>
        )}
        {!mockAuthEnabled && isPending && (
          <p role="status" className="text-sm text-muted">
            Loading assigned employees…
          </p>
        )}
        {isError && (
          <p role="alert" className="text-danger text-sm">
            Unable to load employee profiles.
          </p>
        )}
        {!mockAuthEnabled && data?.length === 0 && (
          <p className="auth-notice">
            The owner must assign active employees and server-side PINs to this
            terminal’s branch.
          </p>
        )}
        {mockAuthEnabled && (
          <div className="auth-notice">
            <strong>LOCAL DEMO SWITCHING</strong>
            <p>
              Public demo PIN: 123456. This simulates switching and does not
              provide production authentication.
            </p>
            <Link className="text-link mt-3" to="/">
              Return to workspace
            </Link>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
        <Button
          variant="ghost"
          className="mt-5"
          onClick={() => {
            void signOut(queryClient).catch(() =>
              setError("The local session was cleared."),
            );
          }}
        >
          <LogOut size={16} />
          Sign Out
        </Button>
      </section>
      <footer className="auth-footer">
        Individual employee identity · Secure server verification
      </footer>
    </main>
  );
}
