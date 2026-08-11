import Link from "next/link";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 text-6xl">🌙</div>
      <h1 className="font-display text-3xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-slate-400">
        Night Corner needs a connection to show you the freshest midnight essentials.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Try again
      </Link>
    </div>
  );
}
