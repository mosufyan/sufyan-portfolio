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
import FloatingBackToTop from './components/FloatingBackToTop';
import OfflineIndicator from './components/OfflineIndicator';
import DigitalCardModal from './components/DigitalCardModal';
import { Certification } from './data/portfolioData';

function readSkillFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('skill');
  if (!raw) return null;
  const cleaned = raw.trim().slice(0, 80);
  return cleaned.length > 0 ? cleaned : null;
}

export default function App() {
  const [resumeOpen, setResumeOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [digitalCardOpen, setDigitalCardOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);
  const [selectedSkill, setSelectedSkillState] = useState<string | null>(() => readSkillFromUrl());
  const [focusedCompany, setFocusedCompany] = useState<{ name: string; seq: number } | null>(null);

  const setSelectedSkill = useCallback((skill: string | null) => {
    setSelectedSkillState(skill);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (skill) {
      url.searchParams.set('skill', skill);
    } else {
      url.searchParams.delete('skill');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // Sync browser back/forward navigation with ?skill= query parameter
  useEffect(() => {
    const onPopState = () => {
      setSelectedSkillState(readSkillFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Smoothly scroll to Experience if visitor arrives via a ?skill=... deep link
  useEffect(() => {
    if (!readSkillFromUrl() || window.location.hash) return;
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
            />

            <main>
              <Hero
                onOpenResume={() => setResumeOpen(true)}
                onOpenDigitalCard={() => setDigitalCardOpen(true)}
              />
              <Philosophy />
              <Experience
                selectedSkill={selectedSkill}
                onSelectSkill={setSelectedSkill}
                focusedCompany={focusedCompany}
              />
              <Skills
                selectedSkill={selectedSkill}
                onSelectSkill={setSelectedSkill}
              />
              <Certifications
                selectedSkill={selectedSkill}
                onSelectSkill={setSelectedSkill}
                onSelectCertification={(cert) => setSelectedCert(cert)}
              />
              <Awards />
              <Education />
              <Contact onOpenDigitalCard={() => setDigitalCardOpen(true)} />
            </main>

            <Footer onOpenDigitalCard={() => setDigitalCardOpen(true)} />
          </div>

          <FloatingBackToTop />
          <OfflineIndicator />

          <AnnouncementsModal
            isOpen={announcementsOpen}
            onClose={() => setAnnouncementsOpen(false)}
          />

          <CredentialModal
            certification={selectedCert}
            onClose={() => setSelectedCert(null)}
          />
        </div>

        {/* Outside site-theme so light remapping cannot wash out dark chrome */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onSelectSkill={setSelectedSkill}
          onSelectCertification={(cert) => setSelectedCert(cert)}
          onFocusCompany={handleFocusCompany}
          onOpenResume={() => setResumeOpen(true)}
          onOpenAnnouncements={() => setAnnouncementsOpen(true)}
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
