import { useEffect, useState, type FormEvent } from "react";
import { api, apiMode, ApiError } from "@/lib/api.js";
import { DEMO_ADMIN, resetDemoData } from "@/lib/demo-api.js";
import { clearAuth, setAuth } from "@/lib/store.js";
import { toast, useAsync, useAuth } from "@/lib/hooks";
import { cn, errorMessage, fieldErrors, formatDate, imgSrc, money } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { mountPage } from "@/components/site/shell";
import { AuthForms } from "@/components/site/auth-forms";
import { ErrorBox, LABELS, Skeleton, type Dish, type Restaurant } from "@/components/site/cards";

type Row = Record<string, unknown>;
type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select" | "multi" | "checkbox" | "image" | "time" | "list" | "date" | "color";
  options?: [string, string][];
  step?: string;
  hint?: string;
  wide?: boolean;
};

const CUISINES = Object.entries(LABELS) as [string, string][];
const STATUSES: [string, string][] = [
  ["received", "Received"],
  ["preparing", "Preparing"],
  ["on_the_way", "On the way"],
  ["ready_for_pickup", "Ready for pickup"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
];

/* ---------- generic create/edit form ---------- */
function EntityForm({ fields, initial, onSubmit, onCancel, submitLabel }: { fields: FieldDef[]; initial: Row; onSubmit: (v: Row) => Promise<void>; onCancel: () => void; submitLabel: string }) {
  const [values, setValues] = useState<Row>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  const upload = async (name: string, file?: File | null) => {
    if (!file) return;
    setUploading(name);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api("/admin/uploads", { method: "POST", form: fd });
      set(name, res.url);
      toast("Image uploaded");
    } catch (err) {
      setErrors((e) => ({ ...e, [name]: errorMessage(err) }));
      if (err instanceof ApiError && err.status === 403) toast(errorMessage(err), "error");
    } finally {
      setUploading("");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      const out: Row = {};
      fields.forEach((f) => {
        const v = values[f.name];
        if (f.type === "number") out[f.name] = v === "" || v == null ? undefined : Number(v);
        else if (f.type === "list") out[f.name] = String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
        else if (f.type === "checkbox") out[f.name] = Boolean(v);
        else out[f.name] = v ?? "";
      });
      await onSubmit(out);
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
      if (err instanceof ApiError && err.status === 403) toast(errorMessage(err), "error"); // e.g. read-only demo admin
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-2xl bg-muted p-5 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const v = values[f.name];
        const cls = f.wide || f.type === "textarea" || f.type === "multi" || f.type === "image" ? "sm:col-span-2" : "";
        if (f.type === "checkbox")
          return (
            <label key={f.name} className={cn("flex min-h-11 items-center gap-2 font-semibold", cls)}>
              <input type="checkbox" className="size-5 accent-[#F17228]" checked={Boolean(v)} onChange={(e) => set(f.name, e.target.checked)} /> {f.label}
            </label>
          );
        if (f.type === "multi")
          return (
            <fieldset key={f.name} className={cls}>
              <legend className="mb-1.5 text-sm font-semibold">{f.label}</legend>
              <div className="flex flex-wrap gap-2">
                {f.options!.map(([val, label]) => {
                  const list = (v as string[]) || [];
                  const on = list.includes(val);
                  return (
                    <label key={val} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm", on ? "border-foreground bg-foreground text-background" : "border-border bg-card")}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => set(f.name, on ? list.filter((x) => x !== val) : [...list, val])} />
                      {label}
                    </label>
                  );
                })}
              </div>
              {errors[f.name] ? <p className="field-error">{errors[f.name]}</p> : null}
            </fieldset>
          );
        if (f.type === "image")
          return (
            <div key={f.name} className={cn("grid gap-3 sm:grid-cols-[96px_1fr]", cls)}>
              <img src={imgSrc(String(v || ""))} alt="" width={96} height={96} className="size-24 rounded-xl object-cover" />
              <div className="space-y-2">
                <Field id={id} label={f.label} error={errors[f.name]} hint="Path like images/pizza.webp, a full URL, or upload a file (WebP/JPEG/PNG, max 800 KB).">
                  <Input value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} />
                </Field>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-foreground/20 bg-card px-4 text-sm font-semibold hover:border-foreground">
                  {uploading === f.name ? "Uploading..." : "Upload image"}
                  <input type="file" accept="image/webp,image/jpeg,image/png,image/avif" className="sr-only" onChange={(e) => upload(f.name, e.target.files?.[0])} />
                </label>
              </div>
            </div>
          );
        const control =
          f.type === "textarea" ? (
            <Textarea value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} />
          ) : f.type === "select" ? (
            <Select value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)}>
              {f.options!.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={f.type === "number" ? "number" : f.type === "time" ? "time" : f.type === "date" ? "date" : f.type === "color" ? "color" : "text"}
              step={f.step}
              value={f.type === "list" && Array.isArray(v) ? v.join(", ") : String(v ?? "")}
              onChange={(e) => set(f.name, e.target.value)}
            />
          );
        return (
          <Field key={f.name} id={id} label={f.label} error={errors[f.name]} hint={f.hint} className={cls}>
            {control}
          </Field>
        );
      })}
      {formError ? (
        <p role="alert" className="rounded-lg bg-[#fdf0ee] p-3 text-sm font-semibold text-danger sm:col-span-2">
          {formError}
        </p>
      ) : null}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ---------- generic CRUD table ---------- */
function Crud<T extends Row>({
  title,
  singular,
  load,
  keyOf,
  columns,
  fields,
  blank,
  create,
  update,
  remove,
}: {
  title: string;
  singular: string;
  load: () => Promise<T[]>;
  keyOf: (r: T) => string;
  columns: [string, (r: T) => React.ReactNode][];
  fields: FieldDef[];
  blank: Row;
  create: (v: Row) => Promise<unknown>;
  update: (key: string, v: Row) => Promise<unknown>;
  remove: (key: string) => Promise<unknown>;
}) {
  const { data, error, loading, reload } = useAsync(load, []);
  const [editing, setEditing] = useState<{ key: string | null; row: Row } | null>(null);
  const [filter, setFilter] = useState("");
  const rows = (data || []).filter((r) => !filter || JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()));

  return (
    <section aria-label={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">
          {title} <span className="text-muted-foreground">({data?.length ?? 0})</span>
        </h2>
        <div className="flex gap-2">
          <label htmlFor={`filter-${title}`} className="sr-only">
            Filter {title}
          </label>
          <Input id={`filter-${title}`} placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-44" />
          <Button onClick={() => setEditing({ key: null, row: blank })}>New</Button>
        </div>
      </div>
      {editing ? (
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold">{editing.key ? `Edit ${editing.key}` : `New ${singular}`}</h3>
          <EntityForm
            key={editing.key ?? "new"}
            fields={fields}
            initial={editing.row}
            submitLabel={editing.key ? "Save changes" : "Create"}
            onCancel={() => setEditing(null)}
            onSubmit={async (v) => {
              if (editing.key) await update(editing.key, v);
              else await create(v);
              toast(editing.key ? "Saved" : "Created");
              setEditing(null);
              reload();
            }}
          />
        </div>
      ) : null}
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      {loading ? <Skeleton className="h-60" /> : null}
      <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/5">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map(([h]) => (
                <th key={h} scope="col" className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={keyOf(r)}>
                {columns.map(([h, render]) => (
                  <td key={h} className="px-4 py-2.5 align-middle">
                    {render(r)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ key: keyOf(r), row: r })}>
                    Edit
                  </Button>
                  <ConfirmButton
                    className="text-danger"
                    question={`Delete ${keyOf(r)}?`}
                    onConfirm={async () => {
                      try {
                        await remove(keyOf(r));
                        toast("Deleted");
                        reload();
                      } catch (err) {
                        toast(errorMessage(err), "error");
                      }
                    }}
                  >
                    Delete
                  </ConfirmButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- tabs ---------- */
function Overview() {
  const { data, error, reload } = useAsync(() => api("/admin/stats"), []);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const s = data || {};
  const tiles: [string, string][] = [
    ["Orders", s.orders ?? "–"],
    ["Revenue (demo)", s.revenue != null ? money(s.revenue) : "–"],
    ["Restaurants", s.restaurants ?? "–"],
    ["Dishes", s.dishes ?? "–"],
    ["Users", s.users ?? "–"],
    ["Subscribers", s.subscribers ?? "–"],
    ["Open messages", s.openMessages ?? "–"],
  ];
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map(([k, v]) => (
        <div key={k} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
          <dt className="mono text-muted-foreground">{k}</dt>
          <dd className="mt-2 font-display text-4xl font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

type AdminOrder = { reference: string; status: string; mode: string; total: number; createdAt: string; customer: { name: string; phone: string; address: string }; items: { qty: number; name: string }[] };
function Orders() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useAsync(() => api(`/admin/orders${status ? `?status=${status}` : ""}`) as Promise<AdminOrder[]>, [status]);
  const change = async (ref: string, s: string) => {
    try {
      await api(`/admin/orders/${ref}`, { method: "PATCH", body: { status: s } });
      toast(`${ref} is now ${s.replace(/_/g, " ")}`);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  return (
    <section aria-label="Orders">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Orders</h2>
        <div className="flex gap-2">
          <label htmlFor="order-status" className="sr-only">
            Filter by status
          </label>
          <Select id="order-status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-52">
            <option value="">All statuses</option>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={reload}>
            Refresh
          </Button>
        </div>
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      {loading ? <Skeleton className="h-40" /> : null}
      {data && data.length === 0 ? <p className="text-muted-foreground">No orders yet. Place one from the shop to see it here.</p> : null}
      <ul className="space-y-3">
        {(data || []).map((o) => (
          <li key={o.reference} className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="font-semibold">
                {o.reference} · {money(o.total)} · {o.mode}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(o.createdAt)} · {o.customer?.name} · {o.customer?.phone} {o.customer?.address ? `· ${o.customer.address}` : ""}
              </p>
              <p className="text-sm">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label htmlFor={`st-${o.reference}`} className="sr-only">
                Status of {o.reference}
              </label>
              <Select id={`st-${o.reference}`} value={o.status} onChange={(e) => change(o.reference, e.target.value)} className="w-48">
                {STATUSES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
              <ConfirmButton
                size="md"
                className="text-danger"
                question={`Delete order ${o.reference}?`}
                onConfirm={async () => {
                  try {
                    await api(`/admin/orders/${o.reference}`, { method: "DELETE" });
                    toast(`Order ${o.reference} deleted`);
                    reload();
                  } catch (err) {
                    toast(errorMessage(err), "error");
                  }
                }}
              >
                Delete
              </ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Restaurants() {
  return (
    <Crud<Restaurant & Row>
      title="Restaurants"
      singular="restaurant"
      load={() => api("/restaurants")}
      keyOf={(r) => r.slug}
      columns={[
        ["", (r) => <img src={imgSrc(r.image)} alt="" width={48} height={48} className="size-12 max-w-none rounded-lg object-cover" />],
        ["Name", (r) => <a href={`restaurant.html?slug=${r.slug}`} className="font-semibold underline-offset-4 hover:underline">{r.name}</a>],
        ["Cuisines", (r) => r.cuisines.map((c) => LABELS[c] || c).join(", ")],
        ["Rating", (r) => r.rating],
        ["Delivery", (r) => `${r.deliveryTime} min · ${money(r.deliveryFee)}`],
        ["Hours", (r) => `${r.opensAt}–${r.closesAt}`],
      ]}
      fields={[
        { name: "name", label: "Name" },
        { name: "slug", label: "Slug (URL)", hint: "lowercase-with-dashes" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "cuisines", label: "Cuisines", type: "multi", options: CUISINES },
        { name: "priceLevel", label: "Price level", type: "select", options: [["1", "$"], ["2", "$$"], ["3", "$$$"]] },
        { name: "rating", label: "Base rating (0–5)", type: "number", step: "0.1" },
        { name: "ratingCount", label: "Base rating count", type: "number" },
        { name: "deliveryTime", label: "Delivery time (min)", type: "number" },
        { name: "deliveryFee", label: "Delivery fee ($)", type: "number", step: "0.5" },
        { name: "discount", label: "Discount (%)", type: "number" },
        { name: "opensAt", label: "Opens at", type: "time" },
        { name: "closesAt", label: "Closes at", type: "time" },
        { name: "address", label: "Address", wide: true },
        { name: "chef", label: "Head chef" },
        { name: "alt", label: "Image description (alt text)" },
        { name: "image", label: "Image", type: "image" },
        { name: "fast", label: "Fast delivery badge", type: "checkbox" },
      ]}
      blank={{ name: "", slug: "", description: "", cuisines: [], priceLevel: "2", rating: 0, ratingCount: 0, deliveryTime: 30, deliveryFee: 2, discount: 0, opensAt: "10:00", closesAt: "22:00", address: "", chef: "", alt: "", image: "images/rest-bistro.webp", fast: false }}
      create={(v) => api("/admin/restaurants", { method: "POST", body: { ...v, priceLevel: Number(v.priceLevel) } })}
      update={(k, v) => api(`/admin/restaurants/${k}`, { method: "PUT", body: { ...v, priceLevel: Number(v.priceLevel) } })}
      remove={(k) => api(`/admin/restaurants/${k}`, { method: "DELETE" })}
    />
  );
}

function Dishes() {
  const { data: rests } = useAsync(() => api("/restaurants") as Promise<Restaurant[]>, []);
  if (!rests) return <Skeleton className="h-60" />;
  return (
    <Crud<Dish & Row>
      title="Dishes"
      singular="dish"
      load={() => api("/admin/dishes")}
      keyOf={(d) => d.slug}
      columns={[
        ["", (d) => <img src={imgSrc(d.image)} alt="" width={48} height={48} className="size-12 max-w-none rounded-lg object-cover" />],
        ["Name", (d) => <span className="font-semibold">{d.name}</span>],
        ["Restaurant", (d) => d.restaurantName],
        ["Category", (d) => LABELS[d.cat] || d.cat],
        ["Price", (d) => money(d.price)],
        ["Status", (d) => (d.available === false ? "Hidden" : d.featured ? "Featured" : d.popular ? "Popular" : "On menu")],
      ]}
      fields={[
        { name: "name", label: "Name" },
        { name: "slug", label: "Slug", hint: "lowercase-with-dashes" },
        { name: "restaurant", label: "Restaurant", type: "select", options: rests.map((r) => [r.slug, r.name]) },
        { name: "cat", label: "Category", type: "select", options: CUISINES },
        { name: "price", label: "Price ($)", type: "number", step: "0.1" },
        { name: "chef", label: "Chef" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "image", label: "Photo", type: "image" },
        { name: "alt", label: "Photo description (alt text)", wide: true },
        { name: "cutout", label: "Cut-out plate image (orbit menu)", type: "image" },
        { name: "headline", label: "Orbit headline (2 parts, comma separated)", type: "list", hint: "e.g. Ribeye, Steak frites" },
        { name: "ingredients", label: "Ingredients (comma separated)", type: "list" },
        { name: "accent", label: "Accent colour", type: "color" },
        { name: "popular", label: "Popular", type: "checkbox" },
        { name: "featured", label: "Featured in orbit menu", type: "checkbox" },
        { name: "available", label: "Available", type: "checkbox" },
      ]}
      blank={{ name: "", slug: "", restaurant: rests[0]?.slug, cat: "italian", price: 9.5, chef: "", description: "", image: "images/pizza.webp", alt: "", cutout: "", headline: [], ingredients: [], accent: "#F17228", popular: false, featured: false, available: true }}
      create={(v) => api("/admin/dishes", { method: "POST", body: v })}
      update={(k, v) => api(`/admin/dishes/${k}`, { method: "PUT", body: v })}
      remove={(k) => api(`/admin/dishes/${k}`, { method: "DELETE" })}
    />
  );
}

function Promos() {
  return (
    <Crud<Row>
      title="Promo codes"
      singular="promo code"
      load={() => api("/admin/promos")}
      keyOf={(p) => String(p.code)}
      columns={[
        ["Code", (p) => <span className="mono">{String(p.code)}</span>],
        ["Type", (p) => String(p.type).replace("_", " ")],
        ["Value", (p) => (p.type === "percent" ? `${p.value}%` : p.type === "fixed" ? money(Number(p.value)) : "–")],
        ["Min. subtotal", (p) => money(Number(p.minSubtotal))],
        ["Uses", (p) => `${p.uses ?? 0}${p.maxUses ? ` / ${p.maxUses}` : ""}`],
        ["Active", (p) => (p.active === false ? "No" : "Yes")],
      ]}
      fields={[
        { name: "code", label: "Code", hint: "3–20 letters or digits" },
        { name: "type", label: "Type", type: "select", options: [["percent", "Percent off"], ["fixed", "Fixed amount off"], ["free_delivery", "Free delivery"]] },
        { name: "value", label: "Value (% or $)", type: "number" },
        { name: "minSubtotal", label: "Minimum subtotal ($)", type: "number" },
        { name: "maxUses", label: "Max uses (0 = unlimited)", type: "number" },
        { name: "expiresAt", label: "Expires on (optional)", type: "date" },
        { name: "description", label: "Description", wide: true },
        { name: "active", label: "Active", type: "checkbox" },
      ]}
      blank={{ code: "", type: "percent", value: 10, minSubtotal: 0, maxUses: 0, expiresAt: "", description: "", active: true }}
      create={(v) => api("/admin/promos", { method: "POST", body: v })}
      update={(k, v) => api(`/admin/promos/${k}`, { method: "PUT", body: v })}
      remove={(k) => api(`/admin/promos/${k}`, { method: "DELETE" })}
    />
  );
}

type Msg = { id: string; name: string; email: string; topic: string; message: string; handled: boolean; createdAt: string };
function Messages() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([api("/admin/messages") as Promise<Msg[]>, api("/admin/subscribers") as Promise<{ email: string; createdAt: string }[]>]), []);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-60" />;
  const [msgs, subs] = data;
  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <section aria-label="Messages">
        <h2 className="mb-4 text-2xl font-semibold">Messages ({msgs.length})</h2>
        {msgs.length === 0 ? <p className="text-muted-foreground">No messages yet.</p> : null}
        <ul className="space-y-3">
          {msgs.map((m) => (
            <li key={m.id} className={cn("rounded-2xl p-4 ring-1 ring-foreground/5", m.handled ? "bg-muted" : "bg-card")}>
              <p className="font-semibold">
                {m.name} · <a href={`mailto:${m.email}`} className="underline">{m.email}</a> · <span className="mono">{m.topic}</span>
              </p>
              <p className="mt-1 whitespace-pre-line">{m.message}</p>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{formatDate(m.createdAt)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => api(`/admin/messages/${m.id}`, { method: "PATCH", body: { handled: !m.handled } }).then(reload, (err: Error) => toast(err.message, "error"))}
                >
                  {m.handled ? "Mark as open" : "Mark as handled"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Newsletter subscribers">
        <h2 className="mb-4 text-2xl font-semibold">Subscribers ({subs.length})</h2>
        <ul className="divide-y divide-border rounded-2xl bg-card ring-1 ring-foreground/5">
          {subs.length === 0 ? <li className="p-4 text-muted-foreground">No subscribers yet.</li> : null}
          {subs.map((s) => (
            <li key={s.email} className="flex justify-between gap-3 p-3 text-sm">
              <span className="truncate">{s.email}</span>
              <span className="text-muted-foreground">{formatDate(s.createdAt).split(",")[0]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- public demo admin ---------- */
// "admin" = real admin; "demo" = public read-only demo admin on the live API (writes answer 403).
const isAdminRole = (role?: string) => role === "admin" || role === "demo";

function DemoAdminButton() {
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    try {
      const res = await api("/auth/login", { method: "POST", body: DEMO_ADMIN });
      setAuth({ token: res.token, user: res.user, mode: await apiMode() });
      toast("Signed in as the demo admin");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto mb-8 max-w-md rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
      <p className="font-semibold">Just looking around?</p>
      <p className="mt-1 text-sm text-muted-foreground">Open the panel as a demo admin. No real data can be changed.</p>
      <Button size="lg" className="mt-4 w-full" onClick={signIn} disabled={busy}>
        {busy ? "Signing in..." : "Demo admin"}
      </Button>
    </div>
  );
}

const RESET_FLAG = "fw-demo-reset";

function DemoNote({ mode, role }: { mode: string; role: string }) {
  if (mode === "live" && role !== "demo") return null;
  return (
    <div role="note" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fff6ec] p-4 text-sm ring-1 ring-primary/20">
      <p>
        <span className="mono mr-1 text-primary-strong">Demo mode.</span>
        {mode === "live" ? " Read-only demo admin: every page opens, changes are not saved and customer details are hidden." : " Changes are not saved to a server: they stay in this browser until you reset."}
      </p>
      {mode === "demo" ? (
        <ConfirmButton
          variant="outline"
          confirmLabel="Yes, reset"
          question="Reset all demo data in this browser?"
          onConfirm={() => {
            resetDemoData();
            clearAuth();
            try {
              sessionStorage.setItem(RESET_FLAG, "1");
            } catch {
              /* storage blocked: no toast after the reload */
            }
            window.location.reload();
          }}
        >
          Reset demo data
        </ConfirmButton>
      ) : null}
    </div>
  );
}

const TABS = [
  ["overview", "Overview", Overview],
  ["orders", "Orders", Orders],
  ["restaurants", "Restaurants", Restaurants],
  ["dishes", "Menu", Dishes],
  ["promos", "Promo codes", Promos],
  ["messages", "Messages", Messages],
] as const;

function AdminPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<string | null>(null);
  const [tab, setTab] = useState(() => (TABS.some(([k]) => `#${k}` === location.hash) ? location.hash.slice(1) : "overview"));
  useEffect(() => {
    apiMode().then(setMode);
    try {
      if (sessionStorage.getItem(RESET_FLAG)) {
        sessionStorage.removeItem(RESET_FLAG);
        toast("Demo data was reset");
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    history.replaceState(null, "", `#${tab}`);
  }, [tab]);

  if (mode === null) return <Skeleton className="container-x my-10 h-80" />;
  const valid = auth && auth.mode === mode ? auth : null;
  if (!valid || !isAdminRole(valid.user.role))
    return (
      <div className="container-x py-10 md:py-16">
        {!valid ? <DemoAdminButton /> : null}
        {valid ? (
          <p className="mx-auto mb-8 max-w-md rounded-xl bg-[#fdf0ee] p-4 text-danger">
            You are signed in as {valid.user.email}, which is not an admin account.{" "}
            <button type="button" className="min-h-11 underline" onClick={() => clearAuth()}>
              Sign out
            </button>
          </p>
        ) : null}
        <AuthForms title="Admin sign in." adminOnly />
        <p className="mx-auto mt-6 max-w-md rounded-xl bg-muted p-4 text-sm">
          {mode === "demo" ? (
            <>
              Demo mode: sign in with <strong>{DEMO_ADMIN.email}</strong> / <strong>{DEMO_ADMIN.password}</strong>. Changes are saved in this browser only.
            </>
          ) : (
            <>
              Public read-only demo: <strong>{DEMO_ADMIN.email}</strong> / <strong>{DEMO_ADMIN.password}</strong>. Real admins use the account set by ADMIN_EMAIL and ADMIN_PASSWORD on the API server.
            </>
          )}
        </p>
      </div>
    );

  const Current = TABS.find(([k]) => k === tab)?.[2] ?? Overview;
  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-primary-strong">Admin · {mode === "demo" ? "demo data" : valid.user.role === "demo" ? "live API, read-only demo" : "live API"}</p>
          <h1 className="display mt-2 text-[clamp(2.4rem,6vw,4.4rem)]">Kitchen control.</h1>
        </div>
        <Button variant="outline" onClick={() => clearAuth()}>
          Sign out
        </Button>
      </div>
      <DemoNote mode={mode} role={valid.user.role} />
      <div className="-mx-4 mt-6 mb-8 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Admin sections">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-controls="admin-panel" onClick={() => setTab(k)} className={cn("mono min-h-11 shrink-0 rounded-full border px-4 text-[0.75rem]", tab === k ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground")}>
            {label}
          </button>
        ))}
      </div>
      <div id="admin-panel" role="tabpanel">
        <Current />
      </div>
    </div>
  );
}

mountPage("admin", { root: <AdminPage /> });
