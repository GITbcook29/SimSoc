function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-200 rounded ${className}`} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="border rounded-lg p-4">
      <Bar className="h-3 w-32 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Bar key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TileGridSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="border rounded-lg p-4">
      <Bar className="h-3 w-40 mb-3" />
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="border rounded-lg p-3">
            <Bar className="h-2.5 w-24 mb-2" />
            <Bar className="h-7 w-16 mb-2" />
            <Bar className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="border rounded-lg p-4">
      <Bar className="h-3 w-40 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Bar key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="border rounded-lg p-4">
      <Bar className="h-3 w-56 mb-3" />
      <Bar className="h-56 w-full" />
    </div>
  );
}

export function DocumentSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-3">
      <Bar className="h-4 w-48 mb-2" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Bar key={i} className={`h-3 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
