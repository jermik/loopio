import { Save, FolderOpen } from "lucide-react";
import { useRef, useState } from "react";
import type { Recording } from "@/hooks/useRecorder";

interface FileControlsProps {
  hasActions: boolean;
  onSave: (name: string) => void;
  onLoad: (file: File) => Promise<Recording>;
}

export function FileControls({ hasActions, onSave, onLoad }: FileControlsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loadedName, setLoadedName] = useState<string | null>(null);

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rec = await onLoad(file);
      setLoadedName(rec.name);
    } catch {
      alert("Invalid recording file");
    }
    e.target.value = "";
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSave(loadedName || "Recording")}
          disabled={!hasActions}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
        >
          <FolderOpen className="h-4 w-4" />
          Load
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleLoad} className="hidden" />
        {loadedName && (
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">
            📄 {loadedName}
          </span>
        )}
      </div>
    </div>
  );
}
