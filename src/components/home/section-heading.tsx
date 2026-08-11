export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-neon-purple">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
