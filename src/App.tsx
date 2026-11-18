import { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
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
import FloatingBackToTop from './components/FloatingBackToTop';
import MobileSectionToc from './components/MobileSectionToc';
import OfflineIndicator from './components/OfflineIndicator';
import DigitalCardModal from './components/DigitalCardModal';
import { Certification } from './data/portfolioData';
import { normalizeSelectedSkills, toggleSelectedSkill } from './utils/skillMatcher';

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
  const [resumeOpen, setResumeOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [digitalCardOpen, setDigitalCardOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);
  const [selectedSkills, setSelectedSkillsState] = useState<string[]>(() => readSkillsFromUrl());
  const [focusedCompany, setFocusedCompany] = useState<{ name: string; seq: number } | null>(null);

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

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
              onOpenResume={() => setResumeOpen(true)}
              onOpenAnnouncements={() => setAnnouncementsOpen(true)}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onOpenTerminal={() => setTerminalOpen(true)}
            />

            <main>
              <Hero
                onOpenResume={() => setResumeOpen(true)}
                onOpenDigitalCard={() => setDigitalCardOpen(true)}
                onApplySkills={applySelectedSkills}
              />
              <Philosophy />
              <Experience
                selectedSkills={selectedSkills}
                onSelectSkill={setSelectedSkill}
                onApplySkills={applySelectedSkills}
                focusedCompany={focusedCompany}
              />
              <Skills
                selectedSkills={selectedSkills}
                onSelectSkill={setSelectedSkill}
                onApplySkills={applySelectedSkills}
              />
              <Certifications
                selectedSkills={selectedSkills}
                onSelectSkill={setSelectedSkill}
                onSelectCertification={(cert) => setSelectedCert(cert)}
              />
              <Awards />
              <Education />
              <Contact onOpenDigitalCard={() => setDigitalCardOpen(true)} />
            </main>

            <Footer
              onOpenDigitalCard={() => setDigitalCardOpen(true)}
              onOpenTerminal={() => setTerminalOpen(true)}
            />
          </div>

          <DesktopScrollRail />
          <MobileSectionToc />
          <FloatingBackToTop />
          <OfflineIndicator />
        </div>

        {/* Outside site-theme so light remapping cannot wash out dark chrome */}
        <CredentialModal
          certification={selectedCert}
          onClose={() => setSelectedCert(null)}
        />

        <AnnouncementsModal
          isOpen={announcementsOpen}
          onClose={() => setAnnouncementsOpen(false)}
        />

        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onSelectSkill={setSelectedSkill}
          onSelectCertification={(cert) => setSelectedCert(cert)}
          onFocusCompany={handleFocusCompany}
          onOpenResume={() => setResumeOpen(true)}
          onOpenAnnouncements={() => setAnnouncementsOpen(true)}
          onOpenDigitalCard={() => setDigitalCardOpen(true)}
          onOpenTerminal={() => setTerminalOpen(true)}
        />

        <EngineeringTerminal
          isOpen={terminalOpen}
          onClose={() => setTerminalOpen(false)}
          onOpenResume={() => setResumeOpen(true)}
          onOpenDigitalCard={() => setDigitalCardOpen(true)}
        />

        <DigitalCardModal
          isOpen={digitalCardOpen}
          onClose={() => setDigitalCardOpen(false)}
        />

        <ResumeModal
          isOpen={resumeOpen}
          onClose={() => setResumeOpen(false)}
        />
      </div>
    </MotionConfig>
  );
}
