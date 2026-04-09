import type { RecordedAction } from "@/hooks/useRecorder";

interface ActionTimelineProps {
  actions: RecordedAction[];
  currentAction: number;
}

export function ActionTimeline({ actions, currentAction }: ActionTimelineProps) {
  if (actions.length === 0) return null;

  const duration = actions[actions.length - 1]?.timestamp || 1;

  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Timeline</h3>
      <div className="relative h-8 rounded-lg bg-muted overflow-hidden">
        {/* Progress bar */}
        {currentAction >= 0 && (
          <div
            className="absolute left-0 top-0 h-full bg-playing/20 transition-all duration-100"
            style={{ width: `${(actions[currentAction]?.timestamp / duration) * 100}%` }}
          />
        )}

        {/* Action dots */}
        {actions.filter((_, i) => i % Math.max(1, Math.floor(actions.length / 80)) === 0).map((action, i) => {
          const pct = (action.timestamp / duration) * 100;
          const isKey = action.type.startsWith("key");
          const isClick = action.type === "mousedown";
          if (!isKey && !isClick) return null;

          return (
            <div
              key={i}
              className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
                isKey ? "bg-accent" : "bg-recording/70"
              }`}
              style={{ left: `${pct}%` }}
              title={`${action.type}${action.key ? `: ${action.key}` : ""} @ ${(action.timestamp / 1000).toFixed(2)}s`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs font-mono text-muted-foreground">0s</span>
        <span className="text-xs font-mono text-muted-foreground">{(duration / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
