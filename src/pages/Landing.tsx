import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  MousePointerClick,
  Repeat,
  Gauge,
  Save,
  FileSpreadsheet,
  Briefcase,
  FlaskConical,
  Gamepad2,
  Play,
  Download,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import appScreenshot from "@/assets/app-screenshot.png";
import loopioLogo from "@/assets/loopio-logo.png";

// ─── GitHub Release page URL ───
const GITHUB_RELEASE = "https://github.com/jermik/loopio/releases/tag/v1.0.0";
const DOWNLOAD_URLS = {
  windows: GITHUB_RELEASE,
  mac: GITHUB_RELEASE,
  linux: GITHUB_RELEASE,
};

// ─── OS detection ───
function detectOS(): "windows" | "mac" | "linux" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux")) return "linux";
  return "windows";
}

const OS_LABELS: Record<string, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
};

// ─── Track download ───
function trackDownload(platform: string) {
  if (!supabase) return;
  supabase.from("download_events").insert({ platform }).then(() => {});
}

// ─── Animated counter ───
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(value / 40);
    const id = setInterval(() => {
      start += step;
      if (start >= value) {
        setCount(value);
        clearInterval(id);
      } else setCount(start);
    }, 30);
    return () => clearInterval(id);
  }, [inView, value]);

  return (
    <span ref={ref} className="font-mono text-3xl md:text-4xl font-bold text-primary">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── Section wrapper ───
function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`relative py-24 md:py-32 px-6 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

// ─── Feature card ───
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay }}
      className="group relative glass rounded-2xl p-8 hover:border-primary/30 transition-all duration-500"
    >
      <div className="mb-5 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── Use-case card ───
function UseCaseCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay }}
      className="relative rounded-2xl border border-border/60 bg-card/50 p-8 hover:border-primary/20 transition-all duration-500"
    >
      <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── Navbar ───
function Navbar({ onDemoClick }: { onDemoClick: (e: React.MouseEvent) => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "glass py-3" : "py-5"
      }`}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2 group">
          <img src={loopioLogo} alt="Loopio" className="w-8 h-8 rounded-lg" />
          <span className="text-lg font-bold text-foreground tracking-tight">
            Loo<span className="text-primary">pio</span>
          </span>
        </a>
        <div className="flex items-center gap-6">
          <button
            onClick={onDemoClick}
            className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          >
            Demo
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("usecases")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
          >
            Use Cases
          </button>
          <a href={DOWNLOAD_URLS[detectOS()]} onClick={() => trackDownload(detectOS())}>
            <Button size="sm" className="rounded-full px-5 gap-2 font-medium">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </a>
        </div>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════
// ─── LANDING PAGE ─────────────────────────
// ═══════════════════════════════════════════
export default function Landing() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleWatchDemo = (e: React.MouseEvent) => {
    e.preventDefault();
    const demoSection = document.getElementById("demo");
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play();
          if (videoRef.current.requestFullscreen) {
            videoRef.current.requestFullscreen();
          }
        }
      }, 800);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar onDemoClick={handleWatchDemo} />

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 pb-8">
        {/* Animated gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ y: [0, -30, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/[0.07] blur-[120px]"
          />
          <motion.div
            animate={{ x: [0, 20, 0], y: [0, 15, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-60 -left-40 w-[400px] h-[400px] rounded-full bg-primary/[0.04] blur-[100px]"
          />
          <motion.div
            animate={{ x: [0, -20, 0], y: [0, -15, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-80 -right-40 w-[350px] h-[350px] rounded-full bg-primary/[0.03] blur-[100px]"
          />
        </div>

        <div className="relative z-10 text-center max-w-4xl -mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-border/60 bg-card/40 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Now available for Windows, macOS & Linux
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-foreground mb-6"
          >
            Automate Anything
            <br />
            <span className="text-primary">You Do Repeatedly</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Record your mouse and keyboard once. Replay it forever.
            <br className="hidden md:block" />
            Save hours on repetitive tasks with pixel-perfect automation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={DOWNLOAD_URLS[detectOS()]} onClick={() => trackDownload(detectOS())}>
                <Button
                  size="lg"
                  className="rounded-full px-8 gap-2 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-105 transition-all duration-300"
                >
                  <Download className="w-5 h-5" />
                  Download for {OS_LABELS[detectOS()]}
                </Button>
              </a>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8 gap-2 text-base font-medium border-border/60 hover:border-primary/40 hover:scale-105 transition-all duration-300"
                onClick={handleWatchDemo}
              >
                <Play className="w-4 h-4" />
                Watch Demo
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Also available for</span>
              {(Object.keys(DOWNLOAD_URLS) as Array<keyof typeof DOWNLOAD_URLS>)
                .filter((os) => os !== detectOS())
                .map((os, i, arr) => (
                  <span key={os} className="inline-flex items-center gap-1">
                    <a
                      href={DOWNLOAD_URLS[os]}
                      onClick={() => trackDownload(os)}
                      className="hover:text-primary transition-colors underline underline-offset-4"
                    >
                      {OS_LABELS[os]}
                    </a>
                    {i < arr.length - 1 && <span className="text-border ml-2">·</span>}
                  </span>
                ))}
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 cursor-pointer"
          onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground animate-bounce" />
        </motion.div>
      </section>

      {/* ── APP SHOWCASE / DEMO VIDEO ── */}
      <Section id="demo" className="pt-12 md:pt-16">
        <div className="text-center mb-10">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-primary text-sm font-medium tracking-wider uppercase mb-3"
          >
            Watch Demo
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold text-foreground"
          >
            See Loopio in action
          </motion.h2>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative flex flex-col items-center"
        >
          <div className="relative w-full max-w-3xl">
            <div className="absolute inset-0 -m-8 rounded-3xl bg-primary/[0.08] blur-[60px]" />
            <video
              ref={videoRef}
              className="relative rounded-2xl border border-border/60 shadow-2xl shadow-primary/10 w-full"
              controls
              autoPlay
              muted
              loop
              playsInline
              poster={appScreenshot}
            >
              <source src="/promo-video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="mt-6 text-muted-foreground text-sm text-center max-w-md">
            Record once, replay forever — with humanized mouse movements and adjustable speed up to 5×.
          </p>
        </motion.div>
      </Section>

      {/* ── USE CASES ── */}
      <Section id="usecases">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-primary text-sm font-medium tracking-wider uppercase mb-3"
          >
            Use Cases
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold text-foreground"
          >
            Built for real workflows
          </motion.h2>
        </div>

        {/* Featured: Gaming use case with video */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 rounded-2xl border border-primary/20 bg-card/50 overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="relative aspect-[9/16] md:aspect-auto md:min-h-[400px] bg-black/40 flex items-center justify-center overflow-hidden">
              <video
                className="w-full h-full object-contain"
                autoPlay
                muted
                loop
                playsInline
              >
                <source src="/game-promo.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="flex flex-col justify-center p-8 md:p-12">
              <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">Gaming Automation · <span className="text-green-500">Undetectable</span></h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Automate repetitive in-game tasks like cooking, crafting, or inventory management. 
                Record the clicks once and let Loopio grind for you — anything can be automated with a perfect loop.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  Can loop any skill in any game
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UseCaseCard icon={FileSpreadsheet} title="Data Entry Automation" description="Stop copying and pasting between spreadsheets. Record the flow once and let Loopio handle the rest — row after row, field after field." delay={0} />
          <UseCaseCard icon={Briefcase} title="Repetitive Office Tasks" description="Filing reports, sending routine emails, updating dashboards — automate the mundane parts of your workday and focus on what matters." delay={0.1} />
          <UseCaseCard icon={FlaskConical} title="Testing Workflows" description="Run through UI test scenarios repeatedly with consistent precision. Perfect for QA workflows that need exact replication every time." delay={0.2} />
        </div>
      </Section>

      {/* ── FEATURES ── */}
      <Section id="features">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-primary text-sm font-medium tracking-wider uppercase mb-3"
          >
            Features
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold text-foreground"
          >
            Everything you need to automate
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard icon={MousePointerClick} title="Record in Real-Time" description="Capture every mouse movement, click, scroll, and keystroke with millisecond precision." delay={0} />
          <FeatureCard icon={Repeat} title="Seamless Loop" description="Replay recordings infinitely or set a specific repeat count. Set it and forget it." delay={0.1} />
          <FeatureCard icon={Gauge} title="Speed Control" description="Adjust playback speed from 0.25× to 5× to match your needs perfectly." delay={0.2} />
          <FeatureCard icon={Save} title="Save & Load Scripts" description="Build a library of reusable automation scripts. Name, organize, and share them." delay={0.3} />
        </div>
      </Section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/40 py-12 px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={loopioLogo} alt="Loopio" className="w-7 h-7 rounded-lg" />
            <span className="text-sm font-semibold text-foreground">
              Loo<span className="text-primary">pio</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#usecases" className="hover:text-foreground transition-colors">Use Cases</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Loopio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
