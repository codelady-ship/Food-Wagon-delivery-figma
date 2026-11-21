import { useCallback, useEffect, useState } from "react";
import { getCart, getAuth } from "./store.js";
import { apiMode } from "./api.js";

type Cart = ReturnType<typeof getCart>;
export type Auth = { token: string; mode: string; user: { id: string; name: string; email: string; role: "user" | "admin" | "demo"; favourites: string[] } } | null;

export function useCart(): Cart {
  const [cart, setCart] = useState(getCart());
  useEffect(() => {
    const on = () => setCart({ ...getCart() });
    window.addEventListener("cart:change", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("cart:change", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return cart;
}

export function useAuth(): Auth {
  const [auth, setAuthState] = useState<Auth>(getAuth());
  useEffect(() => {
    const on = () => setAuthState(getAuth());
    window.addEventListener("auth:change", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("auth:change", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return auth;
}

/** "live" | "demo" | null while detecting */
export function useApiMode() {
  const [mode, setMode] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    apiMode().then((m: string) => alive && setMode(m));
    const on = (e: Event) => setMode((e as CustomEvent).detail);
    window.addEventListener("api:mode", on);
    return () => {
      alive = false;
      window.removeEventListener("api:mode", on);
    };
  }, []);
  return mode;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState({ data: null, error, loading: false })
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload, setData: (data: T) => setState((s) => ({ ...s, data })) };
}

/** Fade-up reveal for `.rv` elements (re-scans when deps change). */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const els = document.querySelectorAll(".rv:not(.in)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function toast(message: string, tone: "ok" | "error" = "ok") {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, tone } }));
}
