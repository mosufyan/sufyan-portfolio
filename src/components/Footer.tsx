import { Linkedin } from './icons/Linkedin';
import { Mail, ArrowUp, QrCode, Terminal } from 'lucide-react';
import { motion } from 'motion/react';
import { PERSONAL_INFO } from '../data/portfolioData';
import { useFirebase } from '../contexts/FirebaseContext';
import { HoverLift, Reveal } from './MotionPrimitives';
import PWAInstallButton from './PWAInstallButton';

interface FooterProps {
  onOpenDigitalCard?: () => void;
  onOpenTerminal?: () => void;
}

export default function Footer({ onOpenDigitalCard, onOpenTerminal }: FooterProps) {
  const { effectivePortfolioSettings } = useFirebase();
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-slate-800/80 bg-[#05070b] text-slate-400 py-14">
      <Reveal className="page-shell" y={14}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-800/80">
          {/* Col 1: Brand & Synopsis */}
          <div className="md:col-span-5 space-y-4">
            <HoverLift className="inline-flex items-center gap-2.5">
              <motion.div
                whileHover={{ scale: 1.08, rotate: 360 }}
                transition={{
                  scale: { type: 'spring', stiffness: 400, damping: 20 },
                  rotate: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
                }}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 font-bold font-display text-xs"
              >
                MS
              </motion.div>
              <span className="font-display font-bold text-sm sm:text-base min-[2560px]:text-lg text-white tracking-tight">
                MOHAMMED SUFYAN
              </span>
            </HoverLift>

            <p className="fluid-body text-slate-400 max-w-md font-light">
              Software Engineer with 13+ years of enterprise engineering experience across{' '}
              <span className="sm:hidden">Cisco</span>
              <span className="hidden sm:inline">Cisco Systems Inc.</span>
              , HCL America Inc./HCLTech, and Tata Consultancy Services in the United States, United Kingdom, and India.
            </p>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-200 font-semibold">
              Navigation
            </div>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <a href="#overview" className="inline-block hover:text-cyan-400 hover:translate-x-0.5 transition-all">Overview</a>
              </li>
              <li>
                <a href="#philosophy" className="inline-block hover:text-cyan-400 hover:translate-x-0.5 transition-all">Engineering Philosophy</a>
              </li>
              <li>
                <a href="#experience" className="inline-block hover:text-cyan-400 hover:translate-x-0.5 transition-all">Career Timeline</a>
              </li>
              <li>
                <a href="#skills" className="inline-block hover:text-cyan-400 hover:translate-x-0.5 transition-all">Technical Disciplines</a>
              </li>
              <li>
                <a href="#certifications" className="inline-block hover:text-cyan-400 hover:translate-x-0.5 transition-all">Licenses & Certifications</a>
              </li>
              <li>
                <a href="#honors" className="inline-block hover:text-cyan-400 hover:translate-x-0.5 transition-all">Official Recognitions</a>
              </li>
              <li>
                <a href="#education" className="inline-block hover:text-cyan-400 hover:translate-x-0.5 transition-all">Education & Honors</a>
              </li>
              <li>
                <a href="#contact" className="inline-block hover:text-cyan-400 hover:translate-x-0.5 transition-all">Transmit Message</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Channels & Presence */}
          <div className="md:col-span-4 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-200 font-semibold">
              Channels & Location
            </div>
            <ul className="space-y-2 text-xs font-mono text-slate-400">
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <a href={`mailto:${PERSONAL_INFO.email}`} className="hover:text-cyan-300 transition-colors">
                  {PERSONAL_INFO.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Linkedin className="w-3.5 h-3.5 text-cyan-400" />
                <a href={PERSONAL_INFO.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-300 transition-colors">
                  linkedin.com/in/mohammed-sufyan
                </a>
              </li>
              <li className="text-slate-500 pt-2 text-[11px]">
                Operating out of San Jose, California (PST) · Global Deployments
              </li>
              <li className="pt-2 flex flex-wrap items-center gap-2">
                {effectivePortfolioSettings.enablePwaInstall && <PWAInstallButton />}
                {onOpenDigitalCard && (
                  <button
                    type="button"
                    onClick={onOpenDigitalCard}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-500/40 hover:text-cyan-300 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Digital Card / QR</span>
                  </button>
                )}
                {onOpenTerminal && (
                  <button
                    type="button"
                    onClick={onOpenTerminal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-500/40 hover:text-cyan-300 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Terminal</span>
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500 text-center sm:text-left">
          <div>
            © {new Date().getFullYear()} Mohammed Sufyan. All rights reserved.
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
            <span>Zero Trust Distributed Systems · Multi-Cloud Architecture</span>
            <motion.button
              whileHover={{ y: -2, borderColor: 'rgba(34, 211, 238, 0.4)' }}
              whileTap={{ scale: 0.94 }}
              onClick={scrollToTop}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors shrink-0 cursor-pointer"
              title="Return to top"
              aria-label="Return to top"
            >
              <ArrowUp className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </Reveal>
    </footer>
  );
}
