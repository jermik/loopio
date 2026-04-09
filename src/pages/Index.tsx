import { useState, useEffect } from "react";
import { Circle, Square, Repeat, Settings, Save, FolderOpen, GripHorizontal, Minus, Pin, PinOff, X, Trash2, Play, Plus, Pencil, Check } from "lucide-react";
import logoImg from "@/assets/myloopio-logo.png";
import LicenseGate from "@/components/LicenseGate";

type AppState = "idle" | "recording" | "playing";

interface ScriptEntry {
  name: string;
  actions: number;
  date: number;
}

interface HotkeyConfig {
  record: { vk: number; name: string };
  playStop: { vk: number; name: string };
}

interface TrialStatus {
  mode: "local" | "remote";
  initialized: boolean;
  deviceId: string | null;
  usedSeconds: number;
  remainingSeconds: number;
  limitSeconds: number;
  isExpired: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

declare global {
  interface Window {
    autoflow?: {
      record: () => void;
      stop: () => void;
      loop: () => void;
      save: () => void;
      load: () => void;
      setSpeed: (speed: number) => void;
      setRepeat: (count: number) => void;
      setHumanize: (val: boolean) => void;
      setStartDelay: (val: number) => void;
      setExpanded: (expanded: boolean) => void;
      getBuildInfo: () => Promise<{ variant: 'trial' | 'full' }>;
      getTrialStatus: () => Promise<TrialStatus>;
      getLicenseStatus: () => Promise<{ valid: boolean; licensee?: string; issuedAt?: string; message?: string }> ;
      activateLicense: (key: string) => Promise<{ valid: boolean; licensee?: string; issuedAt?: string; message?: string }> ;
      notifyLicenseActivated: () => void;
      minimize: () => void;
      close: () => void;
      togglePin: () => void;
      getScripts: () => void;
      saveScript: (name: string) => void;
      loadScript: (name: string) => void;
      deleteScript: (name: string) => void;
      renameScript: (oldName: string, newName: string) => void;
      getHotkeys: () => void;
      setHotkey: (which: string, vk: number) => void;
      captureHotkey: (which: string) => void;
      cancelCapture: () => void;
      onHotkeysUpdated: (cb: (data: HotkeyConfig) => void) => void;
      onHotkeyCaptured: (cb: (which: string | null) => void) => void;
      onScriptsUpdated: (cb: (scripts: ScriptEntry[]) => void) => void;
      onStateChanged: (cb: (state: AppState) => void) => void;
      onApiError: (cb: (msg: string) => void) => void;
      onActionCount: (cb: (n: number) => void) => void;
      onNotify: (cb: (msg: string) => void) => void;
      onPinChanged: (cb: (pinned: boolean) => void) => void;
      onRepeatStatus: (cb: (status: { current: number; total: string | number } | null) => void) => void;
      onTrialStatus: (cb: (status: TrialStatus) => void) => void;
    };
  }
}

const ScriptRow = ({ script }: { script: ScriptEntry }) => {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(script.name);

  const handleRename = () => {
    if (newName.trim() && newName.trim() !== script.name) {
      window.autoflow?.renameScript(script.name, newName.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-1 py-0.5">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0 text-foreground outline-none focus:border-primary/50 min-w-0"
          autoFocus
        />
        <button onClick={handleRename} className="p-0.5 rounded hover:bg-primary/20 text-primary"><Check className="h-2.5 w-2.5" /></button>
        <button onClick={() => setEditing(false)} className="p-0.5 text-muted-foreground hover:text-foreground text-[9px]">✕</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-muted/50 group">
      <span className="text-[10px] text-foreground flex-1 truncate">{script.name}</span>
      <span className="text-[8px] text-muted-foreground">{script.actions}</span>
      <button
        onClick={() => { setNewName(script.name); setEditing(true); }}
        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        title="Rename"
      >
        <Pencil className="h-2.5 w-2.5" />
      </button>
      <button
        onClick={() => window.autoflow?.loadScript(script.name)}
        className="p-0.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
        title="Load"
      >
        <Play className="h-2.5 w-2.5" />
      </button>
      <button
        onClick={() => window.autoflow?.deleteScript(script.name)}
        className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Delete"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>
    </div>
  );
};

const Index = () => {
  const [state, setState] = useState<AppState>("idle");
  const [buildVariant, setBuildVariant] = useState<"trial" | "full">("trial");
  const [licenseReady, setLicenseReady] = useState(false);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [isPremium, setIsPremium] = useState(() => localStorage.getItem("myloopio_premium") === "true");
  const [showTrialEnded, setShowTrialEnded] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseError, setLicenseError] = useState("");
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    mode: "local",
    initialized: false,
    deviceId: null,
    usedSeconds: 0,
    remainingSeconds: 3600,
    limitSeconds: 3600,
    isExpired: false,
    lastSyncedAt: null,
    lastError: null,
  });
  const [actionCount, setActionCount] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [repeatCount, setRepeatCount] = useState(0);
  const [humanize, setHumanize] = useState(true);
  const [startDelay, setStartDelayState] = useState(0);
  const [pinned, setPinned] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [repeatStatus, setRepeatStatus] = useState<{ current: number; total: string | number } | null>(null);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>({ record: { vk: 0x75, name: 'F6' }, playStop: { vk: 0x76, name: 'F7' } });
  const [capturing, setCapturing] = useState<string | null>(null);

  useEffect(() => {
    if (!window.autoflow) return;
    window.autoflow.onStateChanged((s) => setState(s));
    window.autoflow.onActionCount((n) => setActionCount(n));
    window.autoflow.onPinChanged((p) => setPinned(p));
    window.autoflow.onScriptsUpdated((s) => setScripts(s));
    window.autoflow.onRepeatStatus((s) => setRepeatStatus(s));
    window.autoflow.onTrialStatus((status) => {
      setTrialStatus(status);
      if (status.isExpired) setShowTrialEnded(true);
    });
    window.autoflow.onHotkeysUpdated((h) => setHotkeys(h));
    window.autoflow.onHotkeyCaptured(() => setCapturing(null));
    window.autoflow.getHotkeys();
    window.autoflow.getBuildInfo?.().then((info) => {
      const variant = info?.variant === 'full' ? 'full' : 'trial';
      setBuildVariant(variant);
      if (variant === 'trial') {
        window.autoflow?.getTrialStatus().then(setTrialStatus).catch(() => {});
        setLicenseReady(false);
        setLicenseChecked(true);
      } else {
        window.autoflow?.getLicenseStatus?.().then((status) => {
          setLicenseReady(Boolean(status?.valid));
        }).catch(() => {
          setLicenseReady(false);
        }).finally(() => setLicenseChecked(true));
      }
    }).catch(() => {
      window.autoflow?.getTrialStatus().then(setTrialStatus).catch(() => {});
      setLicenseChecked(true);
    });
    window.autoflow.onNotify((msg) => {
      setNotification(msg);
      setTimeout(() => setNotification(null), 2000);
    });
  }, []);

  const toggleOptions = () => {
    const next = !showOptions;
    setShowOptions(next);
    if (!next) setShowLibrary(false);
    window.autoflow?.setExpanded(next);
  };

  const handleSpeedChange = (val: number) => { setSpeed(val); window.autoflow?.setSpeed(val); };
  const handleRepeatChange = (val: number) => { setRepeatCount(val); window.autoflow?.setRepeat(val); };
  const handleHumanizeChange = (val: boolean) => { setHumanize(val); window.autoflow?.setHumanize(val); };
  const handleStartDelayChange = (val: number) => { setStartDelayState(val); window.autoflow?.setStartDelay(val); };

  const openLibrary = () => {
    setShowLibrary(!showLibrary);
    setShowSaveInput(false);
    window.autoflow?.getScripts();
  };

  const handleSaveScript = () => {
    if (saveName.trim()) {
      window.autoflow?.saveScript(saveName.trim());
      setSaveName("");
      setShowSaveInput(false);
    }
  };

  const isRecording = state === "recording";
  const isPlaying = state === "playing";
  const isIdle = state === "idle";
  const trialMinutesLeft = Math.max(0, Math.ceil(trialStatus.remainingSeconds / 60));

  if (!window.autoflow) {
    return (
      <div className="h-screen bg-background flex items-center justify-center p-2">
        <p className="text-xs text-muted-foreground text-center">
          MyLoopio requires the desktop app.<br />Run the .exe for mouse/keyboard automation.
        </p>
      </div>
    );
  }

  if (buildVariant === "full" && !licenseChecked) {
    return (
      <div className="h-screen bg-background flex items-center justify-center p-2">
        <p className="text-xs text-muted-foreground text-center">Checking license…</p>
      </div>
    );
  }

  if (buildVariant === "full" && !licenseReady) {
    return <LicenseGate onActivated={() => { window.autoflow?.notifyLicenseActivated?.(); setLicenseReady(true); }} />;
  }

  return (
    <div className="h-screen bg-background flex flex-col select-none overflow-hidden relative">
      {/* Title bar with logo */}
      <div
        className="flex items-center px-2 h-[22px] shrink-0 cursor-grab active:cursor-grabbing"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <img src={logoImg} alt="MyLoopio" className="h-3.5 w-auto object-contain" draggable={false} />
        <span className="text-[9px] text-muted-foreground/50 ml-1 font-medium tracking-wide">MYLOOPIO</span>
        {buildVariant === "trial" && !isPremium && (
          <span className="ml-2 text-[9px] font-mono text-amber-300/90">{trialMinutesLeft}m left</span>
        )}

        {repeatStatus && (
          <span className="text-[9px] text-primary font-mono ml-2">{repeatStatus.current}/{repeatStatus.total}</span>
        )}
        {notification && (
          <span className="text-[9px] text-green-400 animate-pulse ml-1">{notification}</span>
        )}

        <div
          className="ml-auto flex items-center gap-0.5"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <span className={`h-1.5 w-1.5 rounded-full mr-1 ${
            isRecording ? "bg-red-500 animate-pulse" : isPlaying ? "bg-green-500 animate-pulse" : "bg-muted-foreground/20"
          }`} />
          <button
            onClick={() => window.autoflow?.togglePin()}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={pinned ? "Unpin from top" : "Pin to top"}
          >
            {pinned ? <Pin className="h-2.5 w-2.5" /> : <PinOff className="h-2.5 w-2.5" />}
          </button>
          <button
            onClick={() => window.autoflow?.minimize()}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Minimize"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => window.autoflow?.close()}
            className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
            title="Close"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div
        className="flex items-center gap-1 px-2 py-1 shrink-0"
        style={{ WebkitAppRegion: "no-drag", WebkitUserDrag: "none", userSelect: "none" } as React.CSSProperties}
        onDragStart={(e) => e.preventDefault()}
      >
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (isIdle) window.autoflow?.record(); }}
          disabled={!isIdle}
          draggable={false}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all border ${
            isRecording
              ? "bg-red-500/20 border-red-500/50 text-red-400"
              : isIdle
              ? "bg-secondary border-border hover:bg-red-500/10 hover:border-red-500/30 text-foreground cursor-pointer"
              : "bg-secondary border-border opacity-40 cursor-not-allowed text-muted-foreground"
          }`}
        >
          <Circle className={`h-2.5 w-2.5 ${isRecording ? "fill-red-500 text-red-500 animate-pulse" : "text-red-500"}`} />
          Rec
        </button>

        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (!isIdle) window.autoflow?.stop(); }}
          disabled={isIdle}
          draggable={false}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all border ${
            !isIdle
              ? "bg-secondary border-border hover:bg-muted text-foreground cursor-pointer"
              : "bg-secondary border-border opacity-40 cursor-not-allowed text-muted-foreground"
          }`}
        >
          <Square className="h-2.5 w-2.5" />
          Stop
        </button>

        <button
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Disabled during playback to prevent recursive loop bug
            if (isPlaying) return;
            if (isIdle && actionCount === 0) return;
            window.autoflow?.loop();
          }}
          disabled={isPlaying || (isIdle && actionCount === 0)}
          draggable={false}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all border cursor-default ${
            isPlaying
              ? "bg-green-500/20 border-green-500/50 text-green-400 opacity-60 cursor-not-allowed"
              : isRecording
              ? "bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30"
              : isIdle && actionCount > 0
              ? "bg-secondary border-border hover:bg-green-500/10 hover:border-green-500/30 text-foreground cursor-pointer"
              : "bg-secondary border-border opacity-40 cursor-not-allowed text-muted-foreground"
          }`}
        >
          <Repeat className="h-2.5 w-2.5" />
          Loop
        </button>

        <button
          onClick={toggleOptions}
          className={`ml-auto p-1 rounded transition-all border ${
            showOptions
              ? "bg-accent border-accent text-accent-foreground"
              : "bg-secondary border-border hover:bg-muted text-muted-foreground"
          }`}
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>

      {/* Options panel */}
      {showOptions && (
        <div className="px-2 pb-2 flex flex-col gap-1.5 border-t border-border/30 pt-2 overflow-y-auto">
          {/* Speed */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Speed</span>
            <input
              type="range" min="0.25" max="5" step="0.25" value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-primary cursor-pointer"
            />
            <span className="text-[10px] text-foreground font-mono w-8 text-right">{speed}x</span>
          </div>
          {/* Repeat */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Repeat</span>
            <input
              type="range" min="0" max="50" step="1" value={repeatCount}
              onChange={(e) => handleRepeatChange(parseInt(e.target.value))}
              className="flex-1 h-1 accent-primary cursor-pointer"
            />
            <span className="text-[10px] text-foreground font-mono w-8 text-right">
              {repeatCount === 0 ? "∞" : repeatCount}
            </span>
          </div>
          {/* Start Delay */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Delay</span>
            <input
              type="range" min="0" max="10" step="1" value={startDelay}
              onChange={(e) => handleStartDelayChange(parseInt(e.target.value))}
              className="flex-1 h-1 accent-primary cursor-pointer"
            />
            <span className="text-[10px] text-foreground font-mono w-8 text-right">
              {startDelay === 0 ? "0s" : `${startDelay}s`}
            </span>
          </div>
          {/* Humanize toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Human</span>
            <button
              onClick={() => handleHumanizeChange(!humanize)}
              className={`text-[9px] px-2 py-0.5 rounded border transition-all ${
                humanize
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-secondary border-border text-muted-foreground"
              }`}
            >
              {humanize ? "ON" : "OFF"}
            </button>
            <span className="text-[9px] text-muted-foreground">
              {humanize ? "natural mouse jitter" : "exact replay"}
            </span>
          </div>
          {/* Configurable Hotkeys */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/20 flex-wrap">
            <span className="text-[9px] text-muted-foreground">Hotkeys:</span>
            <button
              onClick={() => { setCapturing('record'); window.autoflow?.captureHotkey('record'); }}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all ${
                capturing === 'record'
                  ? "bg-primary/20 border-primary/50 text-primary animate-pulse"
                  : "bg-secondary border-border text-foreground/70 hover:border-primary/30"
              }`}
              title="Click then press any key to set record hotkey"
            >
              {capturing === 'record' ? '...' : hotkeys.record.name}
            </button>
            <span className="text-[9px] text-muted-foreground">rec</span>
            <button
              onClick={() => { setCapturing('playStop'); window.autoflow?.captureHotkey('playStop'); }}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all ${
                capturing === 'playStop'
                  ? "bg-primary/20 border-primary/50 text-primary animate-pulse"
                  : "bg-secondary border-border text-foreground/70 hover:border-primary/30"
              }`}
              title="Click then press any key to set play/stop hotkey"
            >
              {capturing === 'playStop' ? '...' : hotkeys.playStop.name}
            </button>
            <span className="text-[9px] text-muted-foreground">play/stop</span>
            <span className="text-[9px] font-mono text-foreground/70 bg-secondary px-1 rounded">Ctrl+Alt</span>
            <span className="text-[9px] text-muted-foreground">stop</span>
          </div>

          {/* File save/load + library */}
          <div className="flex items-center gap-1 pt-1 border-t border-border/20">
            <button
              onClick={() => window.autoflow?.save()}
              disabled={actionCount === 0}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                actionCount > 0
                  ? "bg-secondary border-border hover:bg-muted text-foreground"
                  : "bg-secondary border-border opacity-40 cursor-not-allowed text-muted-foreground"
              }`}
            >
              <Save className="h-2.5 w-2.5" />Save
            </button>
            <button
              onClick={() => window.autoflow?.load()}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-secondary border-border hover:bg-muted text-foreground transition-all"
            >
              <FolderOpen className="h-2.5 w-2.5" />Load
            </button>
            <button
              onClick={openLibrary}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                showLibrary
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-secondary border-border hover:bg-muted text-foreground"
              }`}
            >
              📁 Library
            </button>
            <span className="ml-auto text-[9px] text-muted-foreground font-mono">
              {actionCount > 0 ? `${actionCount} act` : "—"}
            </span>
          </div>

          {/* Script Library */}
          {showLibrary && (
            <div className="border border-border/30 rounded p-1.5 bg-secondary/30">
              {showSaveInput ? (
                <div className="flex items-center gap-1 mb-1">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveScript()}
                    placeholder="Script name..."
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1.5 py-0.5 text-foreground outline-none focus:border-primary/50"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveScript}
                    disabled={!saveName.trim() || actionCount === 0}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowSaveInput(false); setSaveName(""); }}
                    className="text-[9px] px-1 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  disabled={actionCount === 0}
                  className="flex items-center gap-1 w-full text-[10px] px-1.5 py-0.5 rounded border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all mb-1 disabled:opacity-40"
                >
                  <Plus className="h-2.5 w-2.5" /> Save current to library
                </button>
              )}

              <div className="max-h-[80px] overflow-y-auto space-y-0.5">
                {scripts.length === 0 ? (
                  <p className="text-[9px] text-muted-foreground text-center py-1">No saved scripts</p>
                ) : (
                  scripts.map((s) => (
                    <ScriptRow key={s.name} script={s} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {buildVariant === "trial" && showTrialEnded && !isPremium && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-card border border-border rounded-lg p-6 max-w-xs text-center shadow-xl">
            <h2 className="text-base font-semibold text-foreground mb-2">Trial ended</h2>
            <p className="text-sm text-muted-foreground mb-4">
              You've reached the 60-minute limit.<br />
              Unlock the full version for <span className="text-primary font-medium">$12</span>.
            </p>
            <button
              onClick={() => { setShowTrialEnded(false); setShowLicenseModal(true); }}
              className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
            >
              Enter License Key
            </button>
            <button
              onClick={() => setShowTrialEnded(false)}
              className="block mx-auto mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-card border border-border rounded-lg p-5 max-w-xs w-full shadow-xl">
            <h2 className="text-sm font-semibold text-foreground mb-3">Activate License</h2>
            <input
              type="text"
              value={licenseInput}
              onChange={(e) => { setLicenseInput(e.target.value); setLicenseError(""); }}
              placeholder="Enter license key"
              className="w-full px-3 py-1.5 rounded bg-background border border-border text-foreground text-sm outline-none focus:border-primary/50 mb-2"
            />
            {licenseError && <p className="text-xs text-destructive mb-2">{licenseError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const key = licenseInput.trim().toUpperCase();
                  if (key === "MYLOOPIO-TEST-1234") {
                    localStorage.setItem("myloopio_premium", "true");
                    setIsPremium(true);
                    setShowLicenseModal(false);
                    setLicenseInput("");
                    setLicenseError("");
                    console.log("[License] Activated");
                  } else {
                    setLicenseError("Invalid license key");
                    console.log("[License] Invalid key:", key);
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
              >
                Activate
              </button>
              <button
                onClick={() => { setShowLicenseModal(false); setLicenseError(""); setLicenseInput(""); }}
                className="px-3 py-1.5 rounded border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
