import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Keyboard } from "lucide-react";

export interface HotkeyConfig {
  record: string;
  play: string;
  stop: string;
  stopAll: string;
}

const DEFAULT_HOTKEYS: HotkeyConfig = {
  record: "F1",
  play: "F2",
  stop: "Ctrl+Alt",
  stopAll: "Escape",
};

interface HotkeySettingsProps {
  hotkeys: HotkeyConfig;
  onChange: (hotkeys: HotkeyConfig) => void;
}

const LABELS: Record<keyof HotkeyConfig, string> = {
  record: "Record",
  play: "Play",
  stop: "Stop",
  stopAll: "Stop All",
};

export function HotkeySettings({ hotkeys, onChange }: HotkeySettingsProps) {
  const [listening, setListening] = useState<keyof HotkeyConfig | null>(null);

  const handleKeyCapture = (action: keyof HotkeyConfig) => {
    setListening(action);

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Build key combo string
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Meta");

      const key = e.key;
      if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
      }

      if (parts.length > 0 && !["Control", "Alt", "Shift", "Meta"].includes(parts[parts.length - 1])) {
        onChange({ ...hotkeys, [action]: parts.join("+") });
        setListening(null);
        window.removeEventListener("keydown", handler);
      }
    };

    window.addEventListener("keydown", handler);
  };

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Keyboard className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Hotkeys</h3>
      </div>

      {(Object.keys(LABELS) as (keyof HotkeyConfig)[]).map((action) => (
        <div key={action} className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">{LABELS[action]}</Label>
          <button
            onClick={() => handleKeyCapture(action)}
            className={`min-w-[80px] rounded-lg px-3 py-1.5 text-xs font-mono transition-all ${
              listening === action
                ? "bg-primary/20 text-primary animate-pulse border border-primary/50"
                : "bg-secondary text-secondary-foreground hover:bg-muted border border-border"
            }`}
          >
            {listening === action ? "Press key..." : hotkeys[action]}
          </button>
        </div>
      ))}

      <p className="text-xs text-muted-foreground mt-2">Click a key slot, then press your desired hotkey combo.</p>
    </div>
  );
}

export { DEFAULT_HOTKEYS };
