"use client";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

/**
 * Lightweight "3D" hero scene built with CSS transforms and layered, floating
 * product images. We avoid a heavy WebGL canvas to keep mobile fast; the
 * perspective + parallax gives a premium depth feel. Swap in @react-three/fiber
 * here later if true 3D is desired.
 */
export function NightScene() {
  const reduce = useReducedMotion();

  const float = (y: number, dur: number, delay = 0) =>
    reduce
      ? {}
      : {
          animate: { y: [0, y, 0], rotate: [0, 2, -2, 0] },
          transition: { duration: dur, repeat: Infinity, ease: "easeInOut", delay },
        };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* gradient + starfield */}
      <div className="absolute inset-0 bg-night-radial" />
      <div className="stars" />

      {/* glowing moon */}
      <motion.div
        {...float(-14, 8)}
        className="absolute right-[8%] top-[12%] h-28 w-28 sm:h-40 sm:w-40"
      >
        <div className="relative h-full w-full">
          <div className="absolute inset-0 rounded-full bg-warm-yellow/30 blur-2xl" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-yellow-100 to-amber-300 shadow-[0_0_60px_rgba(251,191,36,0.6)]" />
          <div className="absolute right-2 top-4 h-6 w-6 rounded-full bg-amber-200/60" />
          <div className="absolute bottom-6 left-4 h-4 w-4 rounded-full bg-amber-200/50" />
        </div>
      </motion.div>

      {/* glowing neon shop */}
      <motion.div
        {...float(-10, 9, 0.5)}
        className="absolute bottom-[14%] left-[6%] hidden w-44 sm:block"
      >
        <div className="relative rounded-2xl border border-neon-purple/50 bg-night-800/70 p-3 shadow-neon backdrop-blur-md">
          <div className="mx-auto mb-1 h-10 w-16 rounded-t-lg bg-gradient-to-b from-neon-purple to-neon-blue shadow-neon" />
          <div className="text-center text-[10px] font-bold tracking-widest text-neon-blue">
            NIGHT
          </div>
          <div className="text-center text-sm font-extrabold tracking-wider text-warm-yellow">
            CORNER
          </div>
          <div className="mt-1 flex justify-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warm-yellow" style={{ animationDelay: "0.4s" }} />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-pink" style={{ animationDelay: "0.8s" }} />
          </div>
        </div>
      </motion.div>

      {/* delivery scooter */}
      <motion.div
        {...(reduce
          ? {}
          : {
              animate: { x: [0, 24, 0], y: [0, -8, 0], rotate: [0, 2, 0] },
              transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            })}
        className="absolute bottom-[18%] right-[12%] text-5xl sm:text-6xl"
      >
        <span className="drop-shadow-[0_0_18px_rgba(56,189,248,0.7)]">🛵</span>
        <span className="absolute -right-2 -top-2 animate-pulse text-2xl">💨</span>
      </motion.div>

      {/* floating products */}
      <FloatProduct src="/images/products/maggi/1.jpg" className="left-[12%] top-[30%] h-20 w-20 sm:h-28 sm:w-28" delay={0} />
      <FloatProduct src="/images/products/dairy-milk/1.jpg" className="right-[22%] top-[46%] h-20 w-20 sm:h-28 sm:w-28" delay={1.2} />
      <FloatProduct src="/images/products/coca-cola/1.jpg" className="left-[26%] bottom-[16%] h-20 w-20 sm:h-28 sm:w-28" delay={0.6} />
      <FloatProduct src="/images/products/lays/1.jpg" className="right-[8%] bottom-[30%] h-16 w-16 sm:h-24 sm:w-24" delay={1.8} />
      <FloatProduct src="/images/products/brownie/1.jpg" className="left-[44%] top-[16%] h-14 w-14 sm:h-20 sm:w-20" delay={2.2} />

      {/* subtle clouds */}
      <motion.div
        {...(reduce ? {} : { animate: { x: [0, 40, 0] }, transition: { duration: 20, repeat: Infinity, ease: "easeInOut" } })}
        className="absolute left-1/4 top-1/3 h-10 w-40 rounded-full bg-white/5 blur-2xl"
      />
    </div>
  );
}

function FloatProduct({
  src,
  className,
  delay,
}: {
  src: string;
  className: string;
  delay: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      {...(reduce
        ? {}
        : {
            animate: { y: [0, -18, 0], rotate: [-4, 4, -4] },
            transition: { duration: 6 + delay, repeat: Infinity, ease: "easeInOut", delay },
          })}
      className={`absolute ${className}`}
    >
      <div className="relative h-full w-full rounded-2xl bg-white/5 p-2 shadow-neon backdrop-blur-sm ring-1 ring-white/10">
        <Image src={src} alt="" fill className="object-contain p-1" sizes="120px" />
      </div>
    </motion.div>
  );
}
