import { useEffect, useRef } from "react";
import type { AppState, RecordedAction } from "@/hooks/useRecorder";

interface RecordingCanvasProps {
  state: AppState;
  currentAction: number;
  actions: RecordedAction[];
  trailPoints: { x: number; y: number }[];
  showTrail: boolean;
  onEvent: (e: MouseEvent | KeyboardEvent) => void;
  setTarget: (el: HTMLElement | null) => void;
}

export function RecordingCanvas({
  state,
  currentAction,
  actions,
  trailPoints,
  showTrail,
  onEvent,
  setTarget,
}: RecordingCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTarget(canvasRef.current);
  }, [setTarget]);

  // Attach recording listeners
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || state !== "recording") return;

    const handler = (e: Event) => onEvent(e as MouseEvent | KeyboardEvent);

    el.addEventListener("mousemove", handler);
    el.addEventListener("mousedown", handler);
    el.addEventListener("mouseup", handler);
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);

    return () => {
      el.removeEventListener("mousemove", handler);
      el.removeEventListener("mousedown", handler);
      el.removeEventListener("mouseup", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, [state, onEvent]);

  const current = currentAction >= 0 ? actions[currentAction] : null;
  const actionCount = actions.length;
  const mouseActions = actions.filter((a) => a.type.startsWith("mouse")).length;
  const keyActions = actions.filter((a) => a.type.startsWith("key")).length;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              state === "recording"
                ? "bg-recording animate-pulse"
                : state === "playing"
                ? "bg-playing animate-pulse"
                : "bg-idle"
            }`}
          />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {state === "recording" ? "Recording..." : state === "playing" ? "Playing..." : "Ready"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
          <span>{actionCount} actions</span>
          <span>🖱 {mouseActions}</span>
          <span>⌨ {keyActions}</span>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        tabIndex={0}
        className={`relative h-[340px] w-full cursor-crosshair select-none outline-none transition-colors ${
          state === "recording" ? "bg-recording/5" : state === "playing" ? "bg-playing/5" : ""
        }`}
      >
        {/* Trail */}
        {showTrail && trailPoints.length > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <polyline
              points={trailPoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="hsl(var(--playing))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.5"
            />
          </svg>
        )}

        {/* Current playback cursor */}
        {state === "playing" && current?.x !== undefined && current?.y !== undefined && (
          <div
            className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-playing/80 shadow-lg shadow-playing/30 transition-all duration-75"
            style={{ left: current.x, top: current.y }}
          >
            <div className="absolute inset-0 rounded-full bg-playing animate-ping opacity-30" />
          </div>
        )}

        {/* Idle state placeholder */}
        {state === "idle" && actionCount === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
            <span className="text-4xl mb-2">🎯</span>
            <span className="text-sm">Click Record to capture actions in this area</span>
            <span className="text-xs mt-1">Mouse movements, clicks & keyboard inputs</span>
          </div>
        )}

        {/* Recording indicator */}
        {state === "recording" && (
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-lg bg-recording/20 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-recording animate-pulse" />
            <span className="text-xs font-mono text-recording">REC</span>
          </div>
        )}

        {/* Key press display during playback */}
        {state === "playing" && current?.type === "keydown" && current?.key && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-playing/20 px-4 py-2">
            <span className="font-mono text-sm text-playing">{current.key}</span>
          </div>
        )}
      </div>
    </div>
  );
}
