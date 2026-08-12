"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Subtle crossfade between routes. On every pathname change the current page
 * fades out (~160ms), then the new page fades in with a gentle rise (~400ms).
 * - The header/footer are outside this wrapper, so only page content animates.
 * - No animation on first load (the BrandIntro splash owns that moment).
 * - `prefers-reduced-motion` users get no animation via the global CSS rule.
 * - Sticky elements are safe: the animation fill mode is `backwards`, so no
 *   transform lingers after it finishes.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "leaving" | "entering">("idle");
  // Snapshot of the *old* page, kept while the leave animation plays (the
  // `children` prop has already switched to the new page at that point).
  const oldChildren = useRef(children);
  const displayedRef = useRef(pathname);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // NOTE: `children` and `displayed` must NOT be dependencies. The router
  // streams new page children (new element identity per chunk) during a nav,
  // and our own swap updates the displayed ref — either would re-run this
  // effect, clear the timers and wedge the state in "entering". The closure
  // captures the current children once, at the moment of the navigation.
  useEffect(() => {
    if (pathname === displayedRef.current) return;
    setState("leaving");
    const t1 = setTimeout(() => {
      displayedRef.current = pathname;
      oldChildren.current = children;
      setState("entering");
      const t2 = setTimeout(() => setState("idle"), 420);
      timers.current.push(t2);
    }, 160);
    timers.current.push(t1);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [pathname]);

  return (
    <div
      className={
        state === "leaving" ? "page-leave" : state === "entering" ? "page-enter" : undefined
      }
    >
      {state === "leaving" ? oldChildren.current : children}
    </div>
  );
}
