import { useMemo, useState } from 'react';
import logoImg from '@/assets/myloopio-logo.png';
import { KeyRound, ShieldCheck, CheckCircle2 } from 'lucide-react';

type Props = {
  onActivated: () => void;
};

export default function LicenseGate({ onActivated }: Props) {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canActivate = useMemo(() => licenseKey.trim().length > 20 && !busy, [licenseKey, busy]);

  const handleActivate = async () => {
    const key = licenseKey.trim();
    if (!key) return;
    setBusy(true);
    setError('');
    try {
      const result = await window.autoflow?.activateLicense(key);
      if (result?.valid) {
        onActivated();
        return;
      }
      setError(result?.message || 'License key is invalid.');
    } catch {
      setError('Activation failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/90 shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <img src={logoImg} alt="MyLoopio" className="h-10 w-10 rounded-xl" />
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">MyLoopio</div>
            <h1 className="text-2xl font-semibold">Activate full version</h1>
          </div>
        </div>

        <div className="grid gap-3 mb-6 text-sm text-muted-foreground">
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
            <ShieldCheck className="h-5 w-5 mt-0.5 text-primary" />
            <div>One-time activation on this device. No trial screen, no timer, full app access after activation.</div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
            <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary" />
            <div>Paste the license key from your purchase email to unlock this device.</div>
          </div>
        </div>

        <label className="block text-sm font-medium mb-2">License key</label>
        <div className="relative mb-3">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <textarea
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="MYLOOPIO-XXXX-XXXX"
            className="min-h-[120px] w-full rounded-xl border border-border bg-background pl-10 pr-3 py-3 text-sm outline-none focus:border-primary/50 resize-y"
          />
        </div>
        {error ? <p className="text-sm text-destructive mb-3">{error}</p> : null}
        <button
          onClick={handleActivate}
          disabled={!canActivate}
          className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium transition-opacity disabled:opacity-50"
        >
          {busy ? 'Activating…' : 'Activate MyLoopio'}
        </button>
      </div>
    </div>
  );
}
