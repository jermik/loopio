import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";
import { useState } from "react";

interface OptionsPanelProps {
  loop: boolean;
  onLoopChange: (v: boolean) => void;
  startDelay: number;
  onStartDelayChange: (v: number) => void;
  showTrail: boolean;
  onShowTrailChange: (v: boolean) => void;
  recordMouse: boolean;
  onRecordMouseChange: (v: boolean) => void;
  recordKeyboard: boolean;
  onRecordKeyboardChange: (v: boolean) => void;
}

export function OptionsPanel(props: OptionsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
      >
        <Settings className="h-4 w-4" />
        Options
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-72 glass rounded-xl p-5 space-y-5 z-50">
          <h3 className="text-sm font-semibold text-foreground">Settings</h3>

          <div className="flex items-center justify-between">
            <Label htmlFor="loop" className="text-sm text-muted-foreground">Loop playback</Label>
            <Switch id="loop" checked={props.loop} onCheckedChange={props.onLoopChange} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="trail" className="text-sm text-muted-foreground">Show mouse trail</Label>
            <Switch id="trail" checked={props.showTrail} onCheckedChange={props.onShowTrailChange} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="recMouse" className="text-sm text-muted-foreground">Record mouse</Label>
            <Switch id="recMouse" checked={props.recordMouse} onCheckedChange={props.onRecordMouseChange} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="recKb" className="text-sm text-muted-foreground">Record keyboard</Label>
            <Switch id="recKb" checked={props.recordKeyboard} onCheckedChange={props.onRecordKeyboardChange} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-muted-foreground">Start delay</Label>
              <span className="text-xs font-mono text-primary">{props.startDelay.toFixed(1)}s</span>
            </div>
            <Slider
              value={[props.startDelay]}
              onValueChange={([v]) => props.onStartDelayChange(v)}
              min={0}
              max={5}
              step={0.5}
            />
          </div>
        </div>
      )}
    </div>
  );
}
