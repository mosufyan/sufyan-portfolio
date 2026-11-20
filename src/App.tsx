import { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { Wrench } from 'lucide-react';
import { useFirebase } from './contexts/FirebaseContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Philosophy from './components/Philosophy';
import Experience from './components/Experience';
import Skills from './components/Skills';
import Certifications from './components/Certifications';
import Awards from './components/Awards';
import Education from './components/Education';
import Contact from './components/Contact';
import Footer from './components/Footer';
import ResumeModal from './components/ResumeModal';
import AnnouncementsModal from './components/AnnouncementsModal';
import CredentialModal from './components/CredentialModal';
import CommandPalette from './components/CommandPalette';
import DesktopScrollRail from './components/DesktopScrollRail';
import EngineeringTerminal from './components/EngineeringTerminal';
import UnifiedScrollHud, { type PortfolioReadingMode } from './components/UnifiedScrollHud';
import DigitalCardModal from './components/DigitalCardModal';
import OwnerConsolePage from './components/OwnerConsolePage';
import ChatWidget from './components/ChatWidget';
import SecurityArchitectureModal from './components/SecurityArchitectureModal';
import { Certification } from './data/portfolioData';
import { normalizeSelectedSkills, toggleSelectedSkill } from './utils/skillMatcher';
import {
  clearCvShareQueryFromBrowser,
  parseCvShareSearch,
  type ParsedCvShareConfig,
} from './utils/cvShareConfig';
import {
  parseOwnerConsoleHash,
  writeOwnerConsoleHash,
  type OwnerConsoleSectionId,
} from './utils/ownerConsoleRouting';

function readSkillsFromUrl(): string[] {
  if (typeof window === 'undefined') return [];
  const params = new URLSearchParams(window.location.search);
  const values = params.getAll('skill');
  const skills = values
    .flatMap((value) => value.split(','))
    .map((skill) => skill.trim().slice(0, 80))
    .filter((skill) => skill.length > 0);
  return normalizeSelectedSkills(skills);
}

function writeSkillsToUrl(skills: string[]) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('skill');
  for (const skill of skills) {
    url.searchParams.append('skill', skill);
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function App() {
  const { effectivePortfolioSettings, isOwner, authReady } = useFirebase();
  const [initialCvShare] = useState<ParsedCvShareConfig>(() =>
    typeof window !== 'undefined' ? parseCvShareSearch(window.location.search) : { shouldOpen: false }
  );
  const [ownerViewRequested, setOwnerViewRequested] = useState(() => {
    if (typeof window === 'undefined') return false;
    return parseOwnerConsoleHash(window.location.hash).open;
  });
  const [ownerConsoleSection, setOwnerConsoleSection] = useState<OwnerConsoleSectionId>(() => {
    if (typeof window === 'undefined') return 'profile';
    return parseOwnerConsoleHash(window.location.hash).section;
  });
  const [resumeOpen, setResumeOpen] = useState(() => initialCvShare.shouldOpen);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [digitalCardOpen, setDigitalCardOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash.replace(/^#/, '').split('?')[0] === 'security';
  });
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);
  const [selectedSkills, setSelectedSkillsState] = useState<string[]>(() => readSkillsFromUrl());
  const [focusedCompany, setFocusedCompany] = useState<{ name: string; seq: number } | null>(null);
  const [readingMode, setReadingMode] = useState<PortfolioReadingMode>(() => {
    if (typeof window === 'undefined') return 'deep';
    return new URLSearchParams(window.location.search).get('mode') === 'brief' ? 'brief' : 'deep';
  });

  const ownerViewActive = isOwner && ownerViewRequested;

  useEffect(() => {
    if (!isOwner && ownerViewRequested) {
      setOwnerViewRequested(false);
      writeOwnerConsoleHash(null);
    }
  }, [isOwner, ownerViewRequested]);

  // Public `#security` deep link for the architecture map
  useEffect(() => {
    const syncSecurityHash = () => {
      const id = window.location.hash.replace(/^#/, '').split('?')[0];
      setSecurityOpen(id === 'security');
    };
    window.addEventListener('hashchange', syncSecurityHash);
    return () => window.removeEventListener('hashchange', syncSecurityHash);
  }, []);

  // Restore / follow `#owner/<section>` deep links once auth is ready
  useEffect(() => {
    if (!authReady) return;
    const applyHash = () => {
      const parsed = parseOwnerConsoleHash(window.location.hash);
      if (parsed.open && isOwner) {
        setOwnerConsoleSection(parsed.section);
        setOwnerViewRequested(true);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [authReady, isOwner]);

  const handleEnterOwnerConsole = useCallback(() => {
    setOwnerViewRequested(true);
    writeOwnerConsoleHash(ownerConsoleSection || 'profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ownerConsoleSection]);

  const handleExitOwnerConsole = useCallback(() => {
    setOwnerViewRequested(false);
    writeOwnerConsoleHash(null);
  }, []);

  const setSelectedSkill = useCallback((skill: string | null) => {
    setSelectedSkillsState((prev) => {
      const next = toggleSelectedSkill(prev, skill);
      writeSkillsToUrl(next);
      return next;
    });
  }, []);

  const applySelectedSkills = useCallback((skills: string[]) => {
    const next = normalizeSelectedSkills(skills);
    setSelectedSkillsState(next);
    writeSkillsToUrl(next);
  }, []);

  // Sync browser back/forward navigation with ?skill= query parameter(s)
  useEffect(() => {
    const onPopState = () => {
      setSelectedSkillsState(readSkillsFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Smoothly scroll to Experience if visitor arrives via a ?skill=... deep link
  useEffect(() => {
    if (readSkillsFromUrl().length === 0 || window.location.hash) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById('experience');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  const features = effectivePortfolioSettings;

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    if (!features.enableCommandPalette) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [features.enableCommandPalette]);

  // Lightweight anonymous pageview beacon for owner SEO / funnel counters
  useEffect(() => {
    if (ownerViewActive || !features.enableSiteTelemetry) return;
    const controller = new AbortController();
    void fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pageview' }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {});
    return () => controller.abort();
  }, [ownerViewActive, features.enableSiteTelemetry]);

  // Close overlays when the owner disables the underlying feature mid-session.
  useEffect(() => {
    if (!features.enableResumeStudio) setResumeOpen(false);
    if (!features.enableAnnouncements) setAnnouncementsOpen(false);
    if (!features.enableCommandPalette) setCommandPaletteOpen(false);
    if (!features.enableDigitalCard) setDigitalCardOpen(false);
    if (!features.enableTerminal) setTerminalOpen(false);
    if (!features.enableReadingModes && readingMode !== 'deep') setReadingMode('deep');
    if (!features.enableSkillFilter && selectedSkills.length > 0) {
      setSelectedSkillsState([]);
      writeSkillsToUrl([]);
    }
  }, [
    features.enableResumeStudio,
    features.enableAnnouncements,
    features.enableCommandPalette,
    features.enableDigitalCard,
    features.enableTerminal,
    features.enableReadingModes,
    features.enableSkillFilter,
    readingMode,
    selectedSkills.length,
  ]);

  // Honor CV share deep links only when Resume Studio is enabled.
  useEffect(() => {
    if (!features.enableResumeStudio && resumeOpen && initialCvShare.shouldOpen) {
      setResumeOpen(false);
      clearCvShareQueryFromBrowser();
    }
  }, [features.enableResumeStudio, resumeOpen, initialCvShare.shouldOpen]);

  const openResume = useCallback(() => {
    if (!features.enableResumeStudio) return;
    setResumeOpen(true);
  }, [features.enableResumeStudio]);
  const openAnnouncements = useCallback(() => {
    if (!features.enableAnnouncements) return;
    setAnnouncementsOpen(true);
  }, [features.enableAnnouncements]);
  const openCommandPalette = useCallback(() => {
    if (!features.enableCommandPalette) return;
    setCommandPaletteOpen(true);
  }, [features.enableCommandPalette]);
  const openDigitalCard = useCallback(() => {
    if (!features.enableDigitalCard) return;
    setDigitalCardOpen(true);
  }, [features.enableDigitalCard]);
  const openTerminal = useCallback(() => {
    if (!features.enableTerminal) return;
    setTerminalOpen(true);
  }, [features.enableTerminal]);
  const openSecurity = useCallback(() => {
    setSecurityOpen(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#security`);
    }
  }, []);
  const closeSecurity = useCallback(() => {
    setSecurityOpen(false);
    if (typeof window !== 'undefined' && window.location.hash.replace(/^#/, '').startsWith('security')) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);
  const skillSelect = features.enableSkillFilter ? setSelectedSkill : () => {};
  const skillApply = features.enableSkillFilter ? applySelectedSkills : () => {};
  const activeSkills = features.enableSkillFilter ? selectedSkills : [];
  const activeReadingMode = features.enableReadingModes ? readingMode : 'deep';
  const changeReadingMode = features.enableReadingModes ? setReadingMode : undefined;

  const handleFocusCompany = useCallback((companyName: string) => {
    setFocusedCompany((prev) => ({ name: companyName, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen print:min-h-0">
        {/* Portfolio chrome follows site theme; ResumeModal stays outside so CV export keeps its own dark/light toggle */}
        <div className="site-theme min-h-screen min-w-0 w-full overflow-x-clip bg-[#06080d] text-slate-200 selection:bg-cyan-500/30 selection:text-cyan-200 transition-colors duration-300">
          <div className={resumeOpen ? 'print:hidden' : ''}>
            <Navbar
              onOpenResume={openResume}
              onOpenAnnouncements={openAnnouncements}
              onOpenCommandPalette={openCommandPalette}
              onOpenTerminal={openTerminal}
              ownerViewActive={ownerViewActive}
              onEnterOwnerConsole={handleEnterOwnerConsole}
              onExitOwnerConsole={handleExitOwnerConsole}
            />

            {ownerViewActive ? (
              <OwnerConsolePage
                onBackToPortfolio={handleExitOwnerConsole}
                onOpenResume={openResume}
                initialSection={ownerConsoleSection}
              />
            ) : (
              <>
                {features.maintenanceMode && (
                  <div
                    role="status"
                    className={`border-b print:hidden ${
                      features.incidentMode
                        ? 'border-rose-500/40 bg-rose-950/40 text-rose-100'
                        : 'border-amber-500/35 bg-amber-950/35 text-amber-200'
                    }`}
                  >
                    <div className="page-shell py-2.5 flex flex-wrap items-center justify-center sm:justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wrench className="w-3.5 h-3.5 shrink-0" />
                        <span className="leading-snug">{features.maintenanceMessage}</span>
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                          features.incidentMode
                            ? 'border-rose-500/50 bg-rose-950/70 text-rose-200'
                            : 'border-amber-500/40 bg-amber-950/60 text-amber-300'
                        }`}
                      >
                        {features.incidentMode ? 'Incident Mode' : 'Maintenance Notice'}
                      </span>
                    </div>
                  </div>
                )}

                <main>
                  <Hero
                    onOpenResume={features.enableResumeStudio ? openResume : undefined}
                    onOpenDigitalCard={features.enableDigitalCard ? openDigitalCard : undefined}
                    onApplySkills={features.enableSkillFilter ? skillApply : undefined}
                    readingMode={activeReadingMode}
                    onChangeReadingMode={changeReadingMode}
                  />
                  <Philosophy readingMode={activeReadingMode} />
                  <Experience
                    selectedSkills={activeSkills}
                    onSelectSkill={skillSelect}
                    onApplySkills={skillApply}
                    focusedCompany={focusedCompany}
                    readingMode={activeReadingMode}
                  />
                  <Skills
                    selectedSkills={activeSkills}
                    onSelectSkill={skillSelect}
                    onApplySkills={skillApply}
                    readingMode={activeReadingMode}
                  />
                  <Certifications
                    selectedSkills={activeSkills}
                    onSelectSkill={skillSelect}
                    onSelectCertification={(cert) => setSelectedCert(cert)}
                    readingMode={activeReadingMode}
                  />
                  <Awards readingMode={activeReadingMode} />
                  <Education readingMode={activeReadingMode} />
                  <Contact
                    onOpenDigitalCard={
                      features.enableDigitalCard ? openDigitalCard : undefined
                    }
                  />
                </main>

                <Footer
                  onOpenDigitalCard={features.enableDigitalCard ? openDigitalCard : undefined}
                  onOpenTerminal={features.enableTerminal ? openTerminal : undefined}
                  onOpenSecurity={openSecurity}
                />
              </>
            )}
          </div>

          {!ownerViewActive && (
            <>
              {features.enableScrollHud && <DesktopScrollRail />}
              {features.enableScrollHud && (
                <UnifiedScrollHud
                  readingMode={activeReadingMode}
                  onChangeReadingMode={changeReadingMode || (() => {})}
                  onOpenCommandPalette={openCommandPalette}
                />
              )}
              {features.enablePortfolioChat && <ChatWidget />}
            </>
          )}
        </div>

        {/* Outside site-theme so light remapping cannot wash out dark chrome */}
        <CredentialModal
          certification={selectedCert}
          onClose={() => setSelectedCert(null)}
        />

        {features.enableAnnouncements && (
          <AnnouncementsModal
            isOpen={announcementsOpen}
            onClose={() => setAnnouncementsOpen(false)}
            onOpenOwnerConsole={handleEnterOwnerConsole}
          />
        )}

        {features.enableCommandPalette && (
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onSelectSkill={skillSelect}
            onSelectCertification={(cert) => setSelectedCert(cert)}
            onFocusCompany={handleFocusCompany}
            onOpenResume={openResume}
            onOpenAnnouncements={openAnnouncements}
            onOpenDigitalCard={openDigitalCard}
            onOpenTerminal={openTerminal}
            onOpenOwnerConsole={handleEnterOwnerConsole}
          />
        )}

        {features.enableTerminal && (
          <EngineeringTerminal
            isOpen={terminalOpen}
            onClose={() => setTerminalOpen(false)}
            onOpenResume={openResume}
            onOpenDigitalCard={openDigitalCard}
          />
        )}

        {features.enableDigitalCard && (
          <DigitalCardModal
            isOpen={digitalCardOpen}
            onClose={() => setDigitalCardOpen(false)}
          />
        )}

        {features.enableResumeStudio && (
          <ResumeModal
            isOpen={resumeOpen}
            initialShareConfig={initialCvShare}
            onClose={() => {
              setResumeOpen(false);
              clearCvShareQueryFromBrowser();
            }}
          />
        )}

        <SecurityArchitectureModal open={securityOpen} onClose={closeSecurity} />
      </div>
    </MotionConfig>
  );
}
