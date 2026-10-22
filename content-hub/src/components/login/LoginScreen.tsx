"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, CircleAlert, Eye, EyeOff, Flame, Lock } from "lucide-react";
import { BrandMark } from "../BrandMark";
import { StageIcon } from "../ui";
import { Constellation } from "./Constellation";

/**
 * The sign-in screen: the saved constellation background in brand purple,
 * the logo hovering on a glass tile that tilts toward the cursor, and a few
 * pieces of the hub drifting around it at different depths.
 */
export function LoginScreen({
  onSignIn,
  note,
}: {
  /** Resolves with an error message, or null when signed in. */
  onSignIn: (password: string) => Promise<string | null>;
  note?: string;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cursor position as -1..1 CSS variables, so parallax costs no re-renders.
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    const problem = await onSignIn(password).catch((err: unknown) => `Couldn't sign in: ${String(err)}`);
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  };

  return (
    <div
      ref={sceneRef}
      className="relative flex min-h-full items-center justify-center overflow-hidden bg-bg px-4 py-12"
      style={{ "--px": 0, "--py": 0 } as CSSProperties}
    >
      <Constellation />

      {/* Pieces of the hub, floating at different depths (wide screens only). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
        <Floater depth={0.6} style={{ left: "8%", top: "14%" }} dur={8} tilt={-4}>
          <div className="w-[92px] overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(120%_90%_at_30%_15%,#3a3a44_0%,#18181d_60%,#0f0f12_100%)] p-2 shadow-2xl shadow-black/60">
            <div className="flex aspect-[9/16] items-center justify-center">
              <span className="rounded bg-white px-1.5 py-1 text-center text-[8px] font-semibold leading-tight text-black">
                nobody claps for the 6am version of you
              </span>
            </div>
          </div>
        </Floater>
        <Floater depth={0.45} style={{ left: "6%", top: "62%" }} dur={9} delay={-3} tilt={2}>
          <Chip>
            <StageIcon stage="scripting" />
            <span className="text-muted">Scripting</span>
            <span className="text-ghost">→</span>
            <StageIcon stage="ready" />
            <span className="text-ink">Ready to record</span>
          </Chip>
        </Floater>
        <Floater depth={1.1} style={{ left: "17%", bottom: "11%" }} dur={7} delay={-1.5} tilt={-2}>
          <Chip className="flex-col items-start gap-2 px-3.5 py-3">
            <span className="text-[11px] text-faint">Views this week</span>
            <span className="flex items-end gap-3">
              <span className="text-xl font-semibold tracking-tight text-ink">48.2K</span>
              <span className="mb-0.5 inline-flex items-center text-xs font-medium text-good-text">
                <ArrowUpRight className="size-3.5" />
                +18%
              </span>
            </span>
            <span className="flex h-6 items-end gap-[3px]">
              {[30, 42, 38, 55, 48, 66, 100].map((h, i) => (
                <span key={i} className={i === 6 ? "w-1.5 rounded-sm bg-ink" : "w-1.5 rounded-sm bg-surface-3"} style={{ height: `${h}%` }} />
              ))}
            </span>
          </Chip>
        </Floater>
        <Floater depth={0.9} style={{ right: "7%", top: "13%" }} dur={8.5} delay={-2} tilt={3}>
          <Chip className="w-60 flex-col items-start gap-1.5 px-3.5 py-3">
            <span className="flex items-center gap-1.5 text-[11px] text-faint">
              <span className="size-2 rounded-[3px] bg-business" /> Hook · Contrarian
            </span>
            <span className="text-[13px] leading-snug text-ink">
              &ldquo;Your ad didn&apos;t stop working. You ran out of people who care.&rdquo;
            </span>
          </Chip>
        </Floater>
        <Floater depth={0.7} style={{ right: "11%", bottom: "15%" }} dur={7.5} delay={-4} tilt={-3}>
          <Chip className="flex-col items-start gap-2 px-3.5 py-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
              <Flame className="size-3.5 text-warning" /> 12-day streak
            </span>
            <span className="flex gap-1">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className={i === 3 ? "size-3 rounded-[3px] bg-heat-2" : "size-3 rounded-[3px] bg-heat-3"} />
              ))}
            </span>
          </Chip>
        </Floater>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* The logo, hovering and tilting toward the cursor. */}
        <div className="mb-8 flex flex-col items-center [perspective:600px]" aria-hidden>
          <div className="hover-up">
            <div
              className="grid size-[104px] place-items-center rounded-[28px] border border-white/15 bg-[linear-gradient(145deg,rgb(178_177_255/0.32),rgb(178_177_255/0.06)_60%)] shadow-[0_30px_80px_-24px_rgb(178_177_255/0.55),inset_0_1px_0_rgb(255_255_255/0.25)] backdrop-blur-md transition-transform duration-300 ease-out"
              style={{ transform: "rotateX(calc(var(--py) * -12deg)) rotateY(calc(var(--px) * 14deg))" }}
            >
              <div className="grid size-16 place-items-center rounded-[18px] bg-brand shadow-[0_8px_30px_-6px_rgb(178_177_255/0.8)]">
                <BrandMark className="size-9" />
              </div>
            </div>
          </div>
          <div className="hover-shadow mt-5 h-2.5 w-20 rounded-[50%] bg-brand/40 blur-md" />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-ink">Content Hub</h1>
        <p className="mt-1.5 text-[13px] text-muted">Sign in to pick up where you left off.</p>

        <form
          onSubmit={submit}
          className="mt-7 w-full rounded-2xl border border-line-strong bg-surface/75 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <label htmlFor="hub-password" className="mb-1.5 block text-xs font-medium text-muted">
            Password
          </label>
          <div className="flex items-center rounded-lg border border-line-strong bg-surface-2 pl-3 pr-1 transition-colors focus-within:border-white/30">
            <Lock className="size-3.5 shrink-0 text-faint" />
            <input
              id="hub-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink placeholder:text-ghost focus:outline-none"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="grid size-8 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-critical-text">
              <CircleAlert className="size-3.5 shrink-0" /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!password || busy}
            className="mt-4 h-10 w-full rounded-lg bg-ink text-[13px] font-semibold text-bg transition-colors hover:bg-white disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {note && <p className="mt-3 text-center text-[11px] text-faint">{note}</p>}
        </form>

        <figure className="mt-10 max-w-xs text-center">
          <blockquote className="text-xs leading-relaxed text-faint">
            &ldquo;You do not rise to the level of your goals. You fall to the level of your systems.&rdquo;
          </blockquote>
          <figcaption className="mt-1.5 text-[11px] text-ghost">James Clear, Atomic Habits</figcaption>
        </figure>
      </div>
    </div>
  );
}

function Floater({
  depth,
  style,
  dur,
  delay = 0,
  tilt = 0,
  children,
}: {
  depth: number;
  style: CSSProperties;
  dur: number;
  delay?: number;
  tilt?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute transition-transform duration-500 ease-out"
      style={{
        ...style,
        transform: `translate3d(calc(var(--px) * ${depth * -22}px), calc(var(--py) * ${depth * -16}px), 0)`,
        opacity: 0.55 + depth * 0.35,
      }}
    >
      <div className="drift" style={{ "--dur": `${dur}s`, "--delay": `${delay}s`, "--tilt": `${tilt}deg` } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-white/10 bg-surface/80 px-3 py-2 text-xs shadow-2xl shadow-black/50 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}
