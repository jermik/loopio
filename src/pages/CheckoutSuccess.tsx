import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Copy, Download, Loader2, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CheckoutSuccess() {
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setError("No session found. Please check your email for your license key.");
      setLoading(false);
      return;
    }

    supabase.functions
      .invoke("verify-session", { body: { session_id: sessionId } })
      .then(({ data, error: fnError }) => {
        if (fnError || data?.error) {
          setError(data?.error || fnError?.message || "Verification failed");
        } else {
          setLicenseKey(data.license_key);
          setEmail(data.email);
        }
        setLoading(false);
      });
  }, []);

  const copyKey = () => {
    if (licenseKey) {
      navigator.clipboard.writeText(licenseKey);
      toast.success("License key copied!");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/[0.07] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-lg w-full text-center"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground">Verifying your purchase…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">{error}</p>
            <a href="/#/">
              <Button variant="outline" className="rounded-full mt-4">
                Back to Home
              </Button>
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">You're Pro! 🎉</h1>
            <p className="text-muted-foreground">
              Your license key has been generated. Enter it in Loopio to unlock unlimited features.
            </p>

            <div className="w-full glass rounded-xl p-6 mt-2">
              <p className="text-xs text-muted-foreground mb-2">Your License Key</p>
              <div className="flex items-center gap-3 justify-center">
                <code className="text-xl md:text-2xl font-bold text-primary tracking-wider">
                  {licenseKey}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyKey}
                  className="shrink-0 hover:bg-primary/10"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              {email && (
                <p className="text-xs text-muted-foreground mt-3">
                  A copy has been sent to <span className="text-foreground">{email}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <a href="/#/download">
                <Button className="rounded-full px-6 gap-2">
                  <Download className="w-4 h-4" />
                  Download Loopio
                </Button>
              </a>
              <a href="/#/">
                <Button variant="outline" className="rounded-full px-6">
                  Back to Home
                </Button>
              </a>
            </div>
          </div>
        )}

        <div className="mt-12 flex items-center justify-center gap-2 opacity-50">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">
            Loopio
          </span>
        </div>
      </motion.div>
    </div>
  );
}
