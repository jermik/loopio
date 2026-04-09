import { Circle, Square, Play, Repeat } from "lucide-react";
import type { AppState } from "@/hooks/useRecorder";

interface ControlButtonsProps {
  state: AppState;
  hasActions: boolean;
  onRecord: () => void;
  onStop: () => void;
  onPlay: () => void;
  onLoop: () => void; // Stop recording + immediately start looping
}

export function ControlButtons({ state, hasActions, onRecord, onStop, onPlay, onLoop }: ControlButtonsProps) {
  // During recording, the play button becomes a Loop button
  const isRecording = state === "recording";

  return (
    <div className="flex items-center justify-center gap-6">
      {/* Record */}
      <button
        onClick={onRecord}
        disabled={state !== "idle"}
        className={`group relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
          isRecording
            ? "bg-recording glow-red scale-110"
            : state === "idle"
            ? "bg-secondary hover:bg-recording/20 hover:scale-105"
            : "bg-secondary opacity-40 cursor-not-allowed"
        }`}
        title="Record (captures mouse & keyboard)"
      >
        <Circle
          className={`h-6 w-6 transition-colors ${
            isRecording ? "fill-recording-foreground text-recording-foreground" : "text-recording"
          }`}
        />
        {isRecording && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-recording animate-pulse" />
        )}
      </button>

      {/* Stop — only active during playback */}
      <button
        onClick={onStop}
        disabled={state !== "playing"}
        className={`group flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
          state === "playing"
            ? "bg-secondary hover:bg-muted hover:scale-105"
            : "bg-secondary opacity-40 cursor-not-allowed"
        }`}
        title="Stop (Ctrl+Alt)"
      >
        <Square className="h-6 w-6 text-foreground" />
      </button>

      {/* Play / Loop */}
      {isRecording ? (
        // During recording: Loop button — stops recording and starts looping immediately
        <button
          onClick={onLoop}
          className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-playing/20 hover:bg-playing/30 hover:scale-105 transition-all duration-300 glow-green"
          title="Stop recording & start looping immediately"
        >
          <Repeat className="h-6 w-6 text-playing" />
          <span className="absolute -bottom-6 text-xs font-medium text-playing whitespace-nowrap">Loop</span>
        </button>
      ) : (
        // Idle/Playing: normal Play button
        <button
          onClick={onPlay}
          disabled={state !== "idle" || !hasActions}
          className={`group relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
            state === "playing"
              ? "bg-playing glow-green scale-110"
              : state === "idle" && hasActions
              ? "bg-secondary hover:bg-playing/20 hover:scale-105"
              : "bg-secondary opacity-40 cursor-not-allowed"
          }`}
          title="Play recording"
        >
          <Play
            className={`h-6 w-6 ml-1 transition-colors ${
              state === "playing" ? "fill-playing-foreground text-playing-foreground" : "text-playing"
            }`}
          />
          {state === "playing" && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-playing animate-pulse" />
          )}
        </button>
      )}
    </div>
  );
}
