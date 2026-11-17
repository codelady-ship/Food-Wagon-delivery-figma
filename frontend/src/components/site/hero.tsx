import { useEffect, useRef, useState, type FormEvent } from "react";
import { setCartField } from "@/lib/store.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/*
 * Interactive hero (inspired by the thinkingods "turn images into interactive heroes" tutorial):
 * a transparent character cut-out sits on a CSS backdrop (deep coffee brown -> caramel orange,
 * vignette, ambient light). The pointer drives depth: the character tilts toward the cursor, the
 * headline and food chips drift at different depths and the light follows. Movement is eased every
 * frame and returns to the idle pose when the pointer leaves. If a sprite sheet of the animated
 * character exists (frames side by side, gaze from far left to far right), set SPRITE.frames and the
 * cursor scrubs through the frames instead of only tilting the still image.
 * prefers-reduced-motion: everything stays still.
 */
export const CHARACTER = { src: "hero/character.webp", width: 1200, height: 1500 };
export const SPRITE = { src: "hero/character-sprite.webp", frames: 0 }; // 0 = no sprite sheet yet

const CHIPS = [
  { src: "images/pizza.webp", alt: "", cls: "left-[-4%] top-[14%] size-[clamp(64px,9vw,132px)]", d: 46 },
  { src: "images/sushi.webp", alt: "", cls: "right-[-6%] top-[8%] size-[clamp(56px,7.5vw,112px)]", d: 64 },
  { src: "images/burger.webp", alt: "", cls: "right-[-2%] bottom-[22%] size-[clamp(60px,8vw,120px)]", d: 30 },
  { src: "images/ramen.webp", alt: "", cls: "left-[2%] bottom-[16%] size-[clamp(48px,6vw,92px)]", d: 82 },
];

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const [q, setQ] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      el.dataset.state = "static";
      return;
    }
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const frames = SPRITE.frames;

    const tick = () => {
      x += (tx - x) * 0.085;
      y += (ty - y) * 0.085;
      el.style.setProperty("--mx", x.toFixed(4));
      el.style.setProperty("--my", y.toFixed(4));
      if (frames > 1 && spriteRef.current) {
        const f = Math.round(((x + 1) / 2) * (frames - 1));
        spriteRef.current.style.backgroundPosition = `${(f / (frames - 1)) * 100}% 0`;
      }
      if (Math.abs(tx - x) > 0.0008 || Math.abs(ty - y) > 0.0008) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const settle = () => {
      tx = 0;
      ty = 0;
      el.dataset.state = "idle";
      kick();
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1);
      ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1);
      el.dataset.state = "tracking";
      clearTimeout(idle);
      idle = setTimeout(settle, 3200); // drift back to the idle pose when the pointer rests
      kick();
    };
    el.dataset.state = "idle";
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", settle);
    const onReduce = () => reduce.matches && settle();
    reduce.addEventListener("change", onReduce);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", settle);
      reduce.removeEventListener("change", onReduce);
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setCartField("mode", mode);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (mode === "pickup") params.set("mode", "pickup");
    window.location.href = `restaurants.html${params.toString() ? `?${params}` : ""}`;
  };

  return (
    <section ref={ref} className="hero" aria-labelledby="hero-title" data-state="idle">
      <div className="hero__bg" aria-hidden="true" />
      <div className="hero__grain" aria-hidden="true" />

      <div className="container-x relative flex flex-col items-center pt-[clamp(28px,5vw,64px)] pb-[clamp(40px,5vw,72px)] text-center">
        <p className="mono flex items-center gap-2 text-secondary">
          <span className="inline-block size-2 rounded-full bg-secondary" aria-hidden="true" />
          Baku · 8 kitchens · 15–40 min delivery
        </p>

        <h1 id="hero-title" className="display hero__title relative z-0 mt-5 max-w-[12ch]">
          <span className="sr-only">Food Wagon, food delivery in Baku: </span>
          Delivered <em>warm</em> &amp; fast.
        </h1>

        <div className="hero__stage relative z-10 -mt-[clamp(20px,4vw,72px)] w-[clamp(220px,25vw,400px)]">
          {CHIPS.map((c) => (
            <span key={c.src} className={cn("hero__chip hidden sm:block", c.cls)} style={{ ["--d" as string]: c.d }} aria-hidden="true">
              <img src={c.src} alt={c.alt} width={132} height={132} loading="eager" />
            </span>
          ))}
          <div className="hero__float">
            <div className="hero__character aspect-[4/5]">
              {SPRITE.frames > 1 ? (
                <div
                  ref={spriteRef}
                  role="img"
                  aria-label="Food Wagon mascot holding a coffee cup"
                  className="hero__sprite"
                  style={{ backgroundImage: `url(${SPRITE.src})`, backgroundSize: `${SPRITE.frames * 100}% 100%` }}
                />
              ) : (
                <img
                  src={CHARACTER.src}
                  alt="Food Wagon mascot holding a coffee cup"
                  width={CHARACTER.width}
                  height={CHARACTER.height}
                  fetchPriority="high"
                  className="size-full object-contain"
                />
              )}
            </div>
          </div>
        </div>

        <form onSubmit={submit} role="search" aria-label="Find food" className="relative z-20 -mt-[clamp(48px,6vw,96px)] w-full max-w-2xl rounded-2xl bg-background p-3 text-left text-foreground shadow-[0_30px_60px_-24px_rgba(20,8,2,.65)] sm:p-4">
          <div className="mb-3 flex gap-2" role="group" aria-label="Order type">
            {(["delivery", "pickup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("mono min-h-11 rounded-lg px-4 text-[0.7rem] transition-colors", mode === m ? "bg-primary/12 text-primary-strong" : "text-muted-foreground hover:bg-foreground/5")}
              >
                {m === "delivery" ? "Delivery" : "Pickup"}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="hero-q" className="sr-only">
              What are you craving?
            </label>
            <input
              id="hero-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pizza, ramen, a restaurant..."
              autoComplete="off"
              className="min-h-14 flex-1 rounded-xl border border-border bg-card px-4 text-base focus:border-primary focus:outline-none"
            />
            <Button type="submit" size="lg">
              Find food
            </Button>
          </div>
        </form>

        <ul className="mono mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-background/85">
          <li>Free delivery from $30</li>
          <li>Live order tracking</li>
          <li>Pay on delivery or demo card</li>
        </ul>
      </div>
    </section>
  );
}
