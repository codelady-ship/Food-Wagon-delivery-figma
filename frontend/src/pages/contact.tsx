import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api.js";
import { errorMessage, fieldErrors } from "@/lib/utils";
import { useApiMode } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { mountPage } from "@/components/site/shell";

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", topic: location.hash === "#partner" ? "partner" : "order", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const mode = useApiMode();
  // footer/FAQ links to #partner on this same page do not reload it, so follow the hash too
  useEffect(() => {
    const onHash = () => { if (location.hash === "#partner") setForm((f) => ({ ...f, topic: "partner" })); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setStatus(null);
    try {
      const res = await api("/contact", { method: "POST", body: form });
      setStatus({ ok: true, text: res.message });
      setForm((f) => ({ ...f, message: "" }));
    } catch (err) {
      setErrors(fieldErrors(err));
      setStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x grid gap-12 py-10 md:py-16 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <p className="mono text-primary-strong">Contact</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,7vw,5.4rem)]">Talk to a human.</h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">Questions about an order, feedback, or you run a kitchen in Baku and want to join? We reply within one working day.</p>
        <dl className="mt-8 space-y-4">
          <div>
            <dt className="mono text-muted-foreground">Order help</dt>
            <dd><p>Have your FW reference ready. You can also <a href="order.html" className="text-primary-strong underline">track it yourself</a>.</p></dd>
          </div>
          <div id="partner" className="scroll-mt-28">
            <dt className="mono text-muted-foreground">Restaurant partners</dt>
            <dd>Pick “Become a partner” and tell us your restaurant name, cuisine and address.</dd>
          </div>
          <div>
            <dt className="mono text-muted-foreground">Hours</dt>
            <dd>Every day, 09:00–23:00 Baku time</dd>
          </div>
        </dl>
        <p className="mt-8 rounded-xl bg-muted p-4 text-sm">
          {mode === "demo"
            ? "This is a portfolio demo running on sample data: your message is saved in this browser only (you can read it in the admin panel) and no email is sent."
            : "This is a portfolio demo: messages are stored in the demo database and read by the site owner."}
        </p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl bg-card p-6 ring-1 ring-foreground/5 md:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ct-name" label="Name" error={errors.name}>
            <Input autoComplete="name" value={form.name} onChange={set("name")} required />
          </Field>
          <Field id="ct-email" label="Email" error={errors.email}>
            <Input type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
          </Field>
        </div>
        <Field id="ct-topic" label="Topic" error={errors.topic}>
          <Select value={form.topic} onChange={set("topic")}>
            <option value="order">Help with an order</option>
            <option value="partner">Become a partner</option>
            <option value="feedback">Feedback</option>
            <option value="other">Something else</option>
          </Select>
        </Field>
        <Field id="ct-message" label="Message" error={errors.message}>
          <Textarea rows={6} maxLength={2000} value={form.message} onChange={set("message")} required />
        </Field>
        <p role="status" aria-live="polite" className={status ? (status.ok ? "rounded-lg bg-[#e3f4e8] p-3 font-semibold text-success" : "rounded-lg bg-[#fdf0ee] p-3 font-semibold text-danger") : "sr-only"}>
          {status?.text}
        </p>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Sending..." : "Send message"}
        </Button>
      </form>
    </div>
  );
}

mountPage("contact", { root: <ContactPage /> });
