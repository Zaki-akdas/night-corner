"use client";
import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

/**
 * Professional product gallery with:
 * - Large 3D-feel hero image (tilt + depth on hover)
 * - Horizontal scrolling thumbnail strip
 * - Smooth crossfade transitions
 * - Click-to-zoom lightbox
 * - Drag/scroll support
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: string[];
  productName: string;
}) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  if (!images.length) images = ["/logo-icon.svg"];

  const next = () => setActive((i) => (i + 1) % images.length);
  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -8, y: px * 12 });
  };

  return (
    <div>
      {/* Hero */}
      <div
        className="card relative aspect-square overflow-hidden p-2"
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        style={{ perspective: "1200px" }}
      >
        <div className="stars opacity-40" />
        <motion.button
          aria-label="Previous image"
          onClick={prev}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="absolute left-3 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-night-950/70 text-white backdrop-blur-md ring-1 ring-white/10 hover:bg-night-900"
        >
          <ChevronLeft className="h-5 w-5" />
        </motion.button>
        <motion.button
          aria-label="Next image"
          onClick={next}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="absolute right-3 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-night-950/70 text-white backdrop-blur-md ring-1 ring-white/10 hover:bg-night-900"
        >
          <ChevronRight className="h-5 w-5" />
        </motion.button>
        <button
          onClick={() => setZoom(true)}
          aria-label="Zoom image"
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-night-950/70 text-white ring-1 ring-white/10 backdrop-blur-md hover:bg-night-900"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateX: tilt.x, rotateY: tilt.y }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: 0.92, rotateY: 15 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.95, rotateY: -15 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Image
                src={images[active]}
                alt={`${productName} — view ${active + 1}`}
                fill
                sizes="(max-width:1024px) 100vw, 520px"
                priority
                className="object-contain p-6 drop-shadow-2xl"
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* image counter */}
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-night-950/70 px-3 py-1 text-xs text-white ring-1 ring-white/10 backdrop-blur-md">
          {active + 1} / {images.length}
        </div>
      </div>

      {/* Horizontal thumbnail strip — scrollable */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {images.map((src, i) => (
          <button
            key={src + i}
            onClick={() => setActive(i)}
            className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-night-900/60 transition ${
              i === active
                ? "border-neon-purple shadow-neon"
                : "border-white/10 opacity-60 hover:opacity-100"
            }`}
            aria-label={`View image ${i + 1}`}
          >
            <Image src={src} alt="" fill sizes="80px" className="object-contain p-1.5" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoom(false)}
            className="fixed inset-0 z-[120] grid place-items-center bg-night-950/90 p-6 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="relative h-full max-h-[90vh] w-full max-w-4xl"
            >
              <Image
                src={images[active]}
                alt={productName}
                fill
                className="object-contain"
              />
            </motion.div>
            <p className="absolute bottom-6 left-1/2 w-max max-w-[90vw] -translate-x-1/2 truncate rounded-full bg-night-900/80 px-4 py-2 text-sm text-white ring-1 ring-white/10">
              {productName} · {active + 1}/{images.length} · click anywhere to close
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
