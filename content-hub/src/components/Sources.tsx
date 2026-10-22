export function Sources({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 text-[11px]">
      <span className="text-faint">Sources</span>
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="max-w-48 truncate text-faint hover:text-accent">
          {u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
        </a>
      ))}
    </div>
  );
}
