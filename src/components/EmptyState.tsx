import Link from "next/link";

export function EmptyState({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-sm text-neutral-500">{text}</p>
      {href && cta && (
        <Link
          href={href}
          className="inline-block mt-3 text-xs font-semibold px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-50"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}
