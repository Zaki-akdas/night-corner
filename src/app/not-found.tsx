import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 text-center">
      <div>
        <div className="text-7xl">🌙</div>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-white">404</h1>
        <p className="mt-2 text-slate-400">This page wandered off into the night.</p>
        <Link href="/" className="btn-primary mt-6">Back home</Link>
      </div>
    </div>
  );
}
