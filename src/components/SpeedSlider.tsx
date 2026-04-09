import { Slider } from "@/components/ui/slider";

interface SpeedSliderProps {
  speed: number;
  onChange: (speed: number) => void;
}

export function SpeedSlider({ speed, onChange }: SpeedSliderProps) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">Playback Speed</span>
        <span className="text-sm font-mono font-semibold text-primary">{speed.toFixed(1)}x</span>
      </div>
      <Slider
        value={[speed]}
        onValueChange={([v]) => onChange(v)}
        min={0.5}
        max={6}
        step={0.1}
        className="w-full"
      />
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">0.5x</span>
        <span className="text-xs text-muted-foreground">6x</span>
      </div>
    </div>
  );
}
