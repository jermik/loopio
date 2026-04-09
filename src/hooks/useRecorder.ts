import { useState, useRef, useCallback, useEffect } from "react";

export type ActionType = "mousemove" | "mousedown" | "mouseup" | "keydown" | "keyup";

export interface RecordedAction {
  type: ActionType;
  timestamp: number;
  x?: number;
  y?: number;
  button?: number;
  key?: string;
  code?: string;
}

export interface Recording {
  name: string;
  actions: RecordedAction[];
  duration: number;
  createdAt: string;
}

export type AppState = "idle" | "recording" | "playing";

interface UseRecorderOptions {
  speed: number;
  loop: boolean;
  startDelay: number;
  showTrail: boolean;
  recordMouse: boolean;
  recordKeyboard: boolean;
}

export function useRecorder(options: UseRecorderOptions) {
  const [state, setState] = useState<AppState>("idle");
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [currentAction, setCurrentAction] = useState<number>(-1);
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>([]);

  const startTimeRef = useRef<number>(0);
  const playbackRef = useRef<number | null>(null);
  const loopRef = useRef<boolean>(options.loop);
  const speedRef = useRef<number>(options.speed);
  const stateRef = useRef<AppState>("idle");
  const isStoppingRef = useRef<boolean>(false);

  useEffect(() => { loopRef.current = options.loop; }, [options.loop]);
  useEffect(() => { speedRef.current = options.speed; }, [options.speed]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const startRecording = useCallback(() => {
    setActions([]);
    setCurrentAction(-1);
    setTrailPoints([]);
    isStoppingRef.current = false;
    startTimeRef.current = performance.now();
    setState("recording");
  }, []);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
    setState("idle");
    setCurrentAction(-1);
    setTrailPoints([]);
  }, []);

  const handleEvent = useCallback((e: MouseEvent | KeyboardEvent) => {
    if (stateRef.current !== "recording") return;
    if (isStoppingRef.current) return;

    const elapsed = performance.now() - startTimeRef.current;

    if (e instanceof MouseEvent) {
      if (!options.recordMouse) return;
      const action: RecordedAction = {
        type: e.type as ActionType,
        timestamp: elapsed,
        x: e.clientX,
        y: e.clientY,
        ...(e.type !== "mousemove" && { button: e.button }),
      };
      setActions((prev) => [...prev, action]);
    } else if (e instanceof KeyboardEvent) {
      if (!options.recordKeyboard) return;
      if (e.ctrlKey && e.altKey) return;
      if (e.key === "Escape") return;

      const action: RecordedAction = {
        type: e.type as ActionType,
        timestamp: elapsed,
        key: e.key,
        code: e.code,
      };
      setActions((prev) => [...prev, action]);
    }
  }, [options.recordMouse, options.recordKeyboard]);

  const dispatchAction = useCallback((action: RecordedAction) => {
    try {
      if (action.type === "mousemove" && action.x != null && action.y != null) {
        const el = document.elementFromPoint(action.x, action.y);
        if (el) {
          el.dispatchEvent(new MouseEvent("mousemove", {
            clientX: action.x, clientY: action.y, bubbles: true, cancelable: true,
          }));
        }
      } else if (action.type === "mousedown" && action.x != null && action.y != null) {
        const el = document.elementFromPoint(action.x, action.y);
        if (el) {
          el.dispatchEvent(new MouseEvent("mousedown", {
            clientX: action.x, clientY: action.y, button: action.button ?? 0,
            bubbles: true, cancelable: true,
          }));
        }
      } else if (action.type === "mouseup" && action.x != null && action.y != null) {
        const el = document.elementFromPoint(action.x, action.y);
        if (el) {
          el.dispatchEvent(new MouseEvent("mouseup", {
            clientX: action.x, clientY: action.y, button: action.button ?? 0,
            bubbles: true, cancelable: true,
          }));
          if (action.button === 0 || action.button == null) {
            el.dispatchEvent(new MouseEvent("click", {
              clientX: action.x, clientY: action.y, bubbles: true, cancelable: true,
            }));
          }
        }
      } else if (action.type === "keydown" && action.key) {
        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: action.key, code: action.code || "", bubbles: true, cancelable: true,
        }));
      } else if (action.type === "keyup" && action.key) {
        document.dispatchEvent(new KeyboardEvent("keyup", {
          key: action.key, code: action.code || "", bubbles: true, cancelable: true,
        }));
      }
    } catch (err) {
      console.warn("Playback dispatch error:", err);
    }
  }, []);

  // Play from a given array of actions (used by stopAndPlayActions)
  const playActions = useCallback((actionsToPlay: RecordedAction[]) => {
    if (actionsToPlay.length === 0) return;

    setState("playing");
    setTrailPoints([]);
    isStoppingRef.current = false;

    const play = () => {
      let i = 0;
      const scheduleNext = () => {
        if (stateRef.current !== "playing" || isStoppingRef.current) return;
        if (i >= actionsToPlay.length) {
          if (loopRef.current) {
            setTrailPoints([]);
            setCurrentAction(-1);
            playbackRef.current = window.setTimeout(play, 300 / speedRef.current);
          } else {
            setState("idle");
            setCurrentAction(-1);
          }
          return;
        }

        const action = actionsToPlay[i];
        const prevTime = i > 0 ? actionsToPlay[i - 1].timestamp : 0;
        const delay = (action.timestamp - prevTime) / speedRef.current;

        playbackRef.current = window.setTimeout(() => {
          if (stateRef.current !== "playing" || isStoppingRef.current) return;
          setCurrentAction(i);
          dispatchAction(action);

          if (action.type === "mousemove" && action.x != null && action.y != null) {
            setTrailPoints((prev) => [...prev, { x: action.x!, y: action.y! }].slice(-100));
          }

          i++;
          scheduleNext();
        }, Math.max(delay, 0));
      };
      scheduleNext();
    };

    play();
  }, [dispatchAction]);

  // Normal playback from current state actions
  const startPlayback = useCallback(() => {
    // Read actions directly from state since we call this when idle
    // We need to use a ref-based approach
    playActions(actions);
  }, [actions, playActions]);

  // Stop recording and immediately start playing the given actions
  const stopAndPlayActions = useCallback((actionsToPlay: RecordedAction[]) => {
    isStoppingRef.current = true;
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
    // Set the actions in state for reference
    setActions(actionsToPlay);
    setCurrentAction(-1);
    setTrailPoints([]);
    
    // Directly start playing without going through idle state
    // Use setTimeout to let React batch the state updates
    setTimeout(() => {
      isStoppingRef.current = false;
      playActions(actionsToPlay);
    }, 10);
  }, [playActions]);

  // Ctrl+Alt emergency stop
  useEffect(() => {
    const handleStop = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && stateRef.current !== "idle") {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener("keydown", handleStop);
    return () => window.removeEventListener("keydown", handleStop);
  }, [stop]);

  return {
    state,
    actions,
    currentAction,
    trailPoints,
    startRecording,
    stop,
    startPlayback,
    stopAndPlayActions,
    handleEvent,
  };
}
