import { useState, type FormEvent } from "react";
import { api, apiMode } from "@/lib/api.js";
import { setAuth } from "@/lib/store.js";
import { toast } from "@/lib/hooks";
import { cn, errorMessage, fieldErrors, qs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const safeNext = () => {
  const n = qs("next");
  return /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(n) ? n : "";
};

export function AuthForms({ title = "Welcome back.", adminOnly = false }: { title?: string; adminOnly?: boolean }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      const body = tab === "login" ? { email: form.email, password: form.password } : form;
      const res = await api(`/auth/${tab}`, { method: "POST", body });
      const mode = await apiMode();
      setAuth({ token: res.token, user: res.user, mode });
      toast(tab === "login" ? `Signed in as ${res.user.name}` : "Account created");
      const next = safeNext();
      if (next) window.location.href = next;
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display text-[clamp(2.6rem,7vw,4.6rem)]">{title}</h1>
      {!adminOnly ? (
        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Sign in or register">
          {(["login", "register"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("mono min-h-11 rounded-lg text-[0.7rem]", tab === t ? "bg-card shadow" : "")}>
              {t === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={submit} noValidate className="mt-6 space-y-4" role="tabpanel">
        {tab === "register" ? (
          <Field id="au-name" label="Name" error={errors.name}>
            <Input autoComplete="name" value={form.name} onChange={set("name")} required />
          </Field>
        ) : null}
        <Field id="au-email" label="Email" error={errors.email}>
          <Input type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
        </Field>
        <Field id="au-password" label="Password" error={errors.password} hint={tab === "register" ? "At least 8 characters." : undefined}>
          <Input type="password" autoComplete={tab === "login" ? "current-password" : "new-password"} value={form.password} onChange={set("password")} required />
        </Field>
        {formError ? (
          <p role="alert" className="rounded-lg bg-[#fdf0ee] p-3 text-sm font-semibold text-danger">
            {formError}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Please wait..." : tab === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}

