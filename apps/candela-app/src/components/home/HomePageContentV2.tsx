'use client';

import Link from 'next/link';
import React from 'react';
import { ArrowRightIcon, CheckCircleIcon, LogOutIcon, UserIcon } from '@/components/icons/VectorIcons';
import { GAME_FAMILIES } from '@candela/shared';
import styles from './HomePageContentV2.module.css';

const TRUST_ITEMS = [
  { title: 'Configurable exercises', detail: 'Session controls that adapt to the activity.' },
  { title: 'Session analytics', detail: 'Accuracy, timing and error measures.' },
  { title: 'Connected workflows', detail: 'Purpose-built patient and clinician views.' },
  { title: 'Responsive access', detail: 'Designed for web, tablet, and mobile devices.' },
];

const CAPABILITIES = [
  {
    title: 'Clinical session controls',
    body: 'Adjust target size, movement, speed, timing, contrast and exercise-specific parameters.',
  },
  {
    title: 'Performance analytics',
    body: 'Review accuracy, reaction time, wrong taps, misses and timeouts across completed sessions.',
  },
  {
    title: 'Patient-friendly play',
    body: 'Focused interfaces reduce visual noise and provide immediate, understandable feedback.',
  },
  {
    title: 'Clinician oversight',
    body: 'Assign modules and levels, connect patients through DocID and review progress over time.',
  },
  {
    title: 'Cross-device delivery',
    body: 'Responsive layouts support individual practice and larger clinical display setups.',
  },
  {
    title: 'Portable session records',
    body: 'Completed session summaries can be reviewed in-app and exported when needed.',
  },
];

const FAQS = [
  {
    question: 'Who is Kandela for?',
    answer:
      'Kandela supports patients completing visual and cognitive exercises and clinicians who configure activities and review progress.',
  },
  {
    question: 'Is Kandela a diagnostic tool?',
    answer:
      'No. Kandela is a therapy-support and practice platform. It does not diagnose conditions or replace professional medical advice.',
  },
  {
    question: 'Do patients need a clinician?',
    answer:
      'Patients can create an individual account. Where professional supervision is appropriate, a clinician can connect through DocID and guide the activity plan.',
  },
  {
    question: 'Which devices are supported?',
    answer:
      'The platform is designed for modern web browsers and supported mobile devices. Individual activities may recommend a particular screen size.',
  },
  {
    question: 'What session information is recorded?',
    answer:
      'Completed sessions may include activity settings, accuracy, response timing and separate counts for wrong taps, misses and timeouts.',
  },
  {
    question: 'Can clinicians review patient progress?',
    answer:
      'Connected clinicians can review completed-session analytics for patients assigned to them, subject to role-based access.',
  },
];

interface HomePageContentProps {
  onOpenDashboard: () => void;
  onSelectFamily?: (familyId: string) => void;
  onOpenAIGaze?: () => void;
  isAuthenticated?: boolean;
  authLoading?: boolean;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  onSignOut?: () => void;
}

function SectionHeading({
  eyebrow,
  title,
  body,
  singleLineBody = false,
  dark = false,
  underlineEyebrow = true,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  singleLineBody?: boolean;
  dark?: boolean;
  underlineEyebrow?: boolean;
}) {
  return (
    <div className={`${styles.reveal} mx-auto mb-10 text-center md:mb-14 ${singleLineBody ? 'max-w-5xl' : 'max-w-3xl'}`}>
      {eyebrow ? (
        <p className={`mb-3 text-xs font-extrabold uppercase tracking-[0.18em] ${dark ? 'text-slate-200' : 'text-slate-950'} ${underlineEyebrow ? 'underline decoration-2 underline-offset-4' : ''}`}>{eyebrow}</p>
      ) : null}
      <h2 className={`text-3xl font-bold tracking-[-0.025em] md:text-4xl ${dark ? 'text-white' : 'text-slate-950'}`}>{title}</h2>
      <p className={`mx-auto mt-4 text-base leading-7 ${dark ? 'text-slate-300' : 'text-slate-600'} ${singleLineBody ? 'max-w-none lg:whitespace-nowrap' : 'max-w-2xl'}`}>
        {body}
      </p>
    </div>
  );
}

function revealStyle(delay = 0): React.CSSProperties {
  return { '--reveal-delay': `${delay}ms` } as React.CSSProperties;
}

function CheckLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircleIcon className="h-3.5 w-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function HomePageContent({
  onOpenDashboard,
  onSelectFamily,
  onOpenAIGaze,
  isAuthenticated = false,
  authLoading = false,
  userName,
  userEmail,
  userRole,
  onSignOut,
}: HomePageContentProps) {
  const pageRef = React.useRef<HTMLDivElement>(null);
  const productMenuRef = React.useRef<HTMLDivElement>(null);
  const accountMenuRef = React.useRef<HTMLDivElement>(null);
  const [isHeaderVisible, setIsHeaderVisible] = React.useState(true);
  const [isProductMenuOpen, setIsProductMenuOpen] = React.useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = React.useState(false);
  const dashboardLabel = authLoading ? 'Checking session…' : isAuthenticated ? 'Open Dashboard' : 'Get Started';

  React.useEffect(() => {
    document.documentElement.classList.add(styles.hideScrollbar);
    return () => document.documentElement.classList.remove(styles.hideScrollbar);
  }, []);

  React.useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const nodes = Array.from(page.querySelectorAll<HTMLElement>(`.${styles.reveal}`));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add(styles.revealVisible));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(styles.revealVisible);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const updateHeaderVisibility = () => {
      setIsHeaderVisible(window.scrollY < 24);
    };

    updateHeaderVisibility();
    window.addEventListener('scroll', updateHeaderVisibility, { passive: true });
    window.addEventListener('resize', updateHeaderVisibility);

    return () => {
      window.removeEventListener('scroll', updateHeaderVisibility);
      window.removeEventListener('resize', updateHeaderVisibility);
    };
  }, []);

  React.useEffect(() => {
    if (!isHeaderVisible) {
      setIsProductMenuOpen(false);
      setIsAccountMenuOpen(false);
    }
  }, [isHeaderVisible]);

  React.useEffect(() => {
    if (!isProductMenuOpen && !isAccountMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (isProductMenuOpen && !productMenuRef.current?.contains(target)) {
        setIsProductMenuOpen(false);
      }
      if (isAccountMenuOpen && !accountMenuRef.current?.contains(target)) {
        setIsAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsProductMenuOpen(false);
      setIsAccountMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isProductMenuOpen, isAccountMenuOpen]);

  const moveSpecularHighlight = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(92, Math.max(8, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(82, Math.max(10, ((event.clientY - rect.top) / rect.height) * 100));
    event.currentTarget.style.setProperty('--specular-x', `${x}%`);
    event.currentTarget.style.setProperty('--specular-y', `${y}%`);
  };
  const resetSpecularHighlight = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--specular-x', '28%');
    event.currentTarget.style.setProperty('--specular-y', '18%');
  };

  return (
    <div ref={pageRef} className="relative min-h-dvh overflow-hidden bg-[#F8FAFF] text-slate-950">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[16rem] -top-[18rem] h-[42rem] w-[42rem] rounded-full bg-blue-300/25 blur-[120px]" />
        <div className="absolute -right-[18rem] top-[28rem] h-[44rem] w-[44rem] rounded-full bg-cyan-200/25 blur-[130px]" />
        <div className="absolute -left-[20rem] top-[75rem] h-[48rem] w-[48rem] rounded-full bg-indigo-200/20 blur-[140px]" />
      </div>

      {isHeaderVisible ? (
        <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-4">
            <Link href="/" className="flex items-center gap-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <img src="/kandela-wordmark-white.png" alt="Kandela" className="h-12 w-auto object-contain" />
            </Link>

            <div className="ml-auto hidden h-14 items-center gap-2 sm:flex">
              <nav aria-label="Homepage" className="hidden items-center gap-1 lg:flex">
                <div ref={productMenuRef} className="relative">
                  <button
                    type="button"
                    aria-expanded={isProductMenuOpen}
                    aria-controls="product-menu"
                    aria-haspopup="menu"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      setIsProductMenuOpen((open) => !open);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)] transition hover:bg-white/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    Product
                    <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 transition ${isProductMenuOpen ? 'rotate-180' : ''}`}>
                      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {isProductMenuOpen ? (
                    <div
                      id="product-menu"
                      role="menu"
                      aria-label="Product"
                      className={`${styles.liquidGlassCard} ${styles.liquidGlassCardDark} ${styles.productMenu} min-w-52 rounded-2xl p-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_40px_-24px_rgba(0,0,0,0.65)]`}
                    >
                      {[
                        ['How it works', '#how-it-works'],
                        ['Activities', '#activities'],
                        ['Capabilities', '#capabilities'],
                        ['Analytics', '#analytics'],
                        ['Access', '#access'],
                      ].map(([label, href]) => (
                        <a
                          key={href}
                          href={href}
                          role="menuitem"
                          onClick={() => setIsProductMenuOpen(false)}
                          className="block rounded-xl px-3 py-2 text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)] transition hover:bg-white/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                        >
                          {label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Link
                  href="/blog"
                  className="rounded-xl px-3 py-2 text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)] transition hover:bg-white/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  Blogs
                </Link>
                <a
                  href="#footer"
                  className="rounded-xl px-3 py-2 text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)] transition hover:bg-white/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  Contact Us
                </a>
                <a
                  href="#footer"
                  className="rounded-xl px-3 py-2 text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)] transition hover:bg-white/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  About
                </a>
              </nav>

              <div className="flex items-center gap-2">
                {!isAuthenticated ? (
                  <Link
                    href="/login"
                    className="rounded-xl px-3 py-2 text-sm font-extrabold text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)] transition hover:bg-white/10 hover:text-blue-200"
                  >
                    Sign in
                  </Link>
                ) : (
                  <div ref={accountMenuRef} className="relative">
                    <button
                      type="button"
                      aria-expanded={isAccountMenuOpen}
                      aria-controls="account-menu"
                      aria-haspopup="menu"
                      aria-label={userName ? `Account menu for ${userName}` : 'Account menu'}
                      onClick={() => {
                        setIsProductMenuOpen(false);
                        setIsAccountMenuOpen((open) => !open);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)] transition hover:bg-white/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                    >
                      <UserIcon className="h-5 w-5" />
                    </button>
                    {isAccountMenuOpen ? (
                      <div
                        id="account-menu"
                        role="menu"
                        aria-label="Account"
                        className={`${styles.liquidGlassCard} ${styles.liquidGlassCardDark} ${styles.accountMenu} w-64 rounded-2xl p-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_40px_-24px_rgba(0,0,0,0.65)]`}
                      >
                        <div className="px-3 pb-2 pt-3">
                          {userName ? (
                            <p
                              className="truncate text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)]"
                              title={userRole === 'patient' ? `user-${userName}` : userName}
                            >
                              {userRole === 'patient' ? `user-${userName}` : userName}
                            </p>
                          ) : null}
                          {userEmail ? (
                            <p className="mt-2 truncate text-xs font-medium text-white/85 [text-shadow:0_1px_8px_rgba(15,23,42,0.75)]" title={userEmail}>
                              {userEmail}
                            </p>
                          ) : null}
                        </div>
                        <div className="mx-2 h-px bg-white/15" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onSignOut?.();
                          }}
                          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(15,23,42,0.75)] transition hover:bg-red-500/15 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          <LogOutIcon className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      ) : null}

      <main className="relative z-10">
        <section className="relative flex min-h-[720px] items-center overflow-hidden bg-slate-950 px-5 pb-28 pt-32 text-white sm:px-8 lg:min-h-[760px]">
          <div aria-hidden className="absolute inset-0">
            <img
              src="/hero-background.gif"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-slate-950/60" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/65" />
            <div className="absolute left-[12%] top-[5%] h-80 w-80 rounded-full bg-blue-600/25 blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[5%] h-96 w-96 rounded-full bg-cyan-500/20 blur-[110px]" />
          </div>

          <div className="relative mx-auto w-full max-w-4xl text-center">
            <div className="mx-auto max-w-4xl">
              <h1 className="text-4xl font-extrabold leading-[1.15] tracking-[-0.04em] sm:text-5xl lg:text-[3.15rem]">
                <span className="block">Interactive vision therapy,</span>
                <span className="mt-1 block">
                  built around{' '}
                  <span className="bg-gradient-to-r from-blue-300 via-sky-200 to-emerald-200 bg-clip-text text-transparent">
                    measurable progress
                  </span>
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Configurable visual and cognitive exercises for patients and clinicians, with clear session
                results and progress analytics across supported devices.
              </p>
              <div className="mt-8 flex flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  disabled={authLoading}
                  aria-busy={authLoading}
                  onPointerMove={moveSpecularHighlight}
                  onPointerLeave={resetSpecularHighlight}
                  className={`${styles.liquidGlassControl} group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border border-white/30 bg-blue-300/[0.08] px-3 py-3.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_-10px_22px_rgba(96,165,250,0.04),0_10px_32px_-12px_rgba(0,0,0,0.3)] transition duration-300 hover:-translate-y-0.5 hover:border-white/45 hover:bg-blue-200/[0.12] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.68),inset_0_0_0_1px_rgba(255,255,255,0.07),inset_0_-10px_24px_rgba(147,197,253,0.08),0_14px_38px_-12px_rgba(0,0,0,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 motion-reduce:transform-none sm:px-7 sm:text-base`}
                >
                  <span aria-hidden className={styles.glassSheen} />
                  <span aria-hidden className={styles.refractionBorder} />
                  <span aria-hidden className={styles.specularHighlight} />
                  <span aria-hidden className={styles.specularEdge} />
                  <span aria-hidden className="absolute inset-x-4 top-px h-px rounded-full bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                  <span aria-hidden className="absolute -bottom-7 left-1/2 h-12 w-4/5 -translate-x-1/2 rounded-full bg-blue-200/20 blur-xl transition group-hover:bg-blue-100/30" />
                  <span
                    aria-hidden
                    className="absolute -left-1/2 top-[-50%] h-[200%] w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 blur-[1px] transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100 motion-reduce:hidden"
                  />
                  <span className="relative z-10 flex items-center gap-2">
                    {dashboardLabel}
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </button>
                <a
                  href="#how-it-works"
                  onPointerMove={moveSpecularHighlight}
                  onPointerLeave={resetSpecularHighlight}
                  className={`${styles.liquidGlassControl} group relative isolate inline-flex items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/[0.035] px-3 py-3.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_-10px_22px_rgba(255,255,255,0.018),0_10px_32px_-12px_rgba(0,0,0,0.3)] transition duration-300 hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/[0.08] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-10px_24px_rgba(255,255,255,0.04),0_14px_38px_-12px_rgba(0,0,0,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none sm:px-7 sm:text-base`}
                >
                  <span aria-hidden className={styles.glassSheen} />
                  <span aria-hidden className={`${styles.refractionBorder} ${styles.refractionBorderNeutral}`} />
                  <span aria-hidden className={styles.specularHighlight} />
                  <span aria-hidden className={styles.specularEdge} />
                  <span aria-hidden className="absolute inset-x-4 top-px h-px rounded-full bg-gradient-to-r from-transparent via-white/85 to-transparent" />
                  <span aria-hidden className="absolute -bottom-7 left-1/2 h-12 w-4/5 -translate-x-1/2 rounded-full bg-white/15 blur-xl transition group-hover:bg-white/25" />
                  <span
                    aria-hidden
                    className="absolute -left-1/2 top-[-50%] h-[200%] w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 blur-[1px] transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100 motion-reduce:hidden"
                  />
                  <span className="relative z-10">See how it works</span>
                </a>
              </div>
              <p className="mx-auto mt-5 flex max-w-2xl items-center justify-center gap-2 text-xs leading-5 text-slate-400">
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-300" fill="none">
                  <path
                    d="M12 3 19 6v5c0 4.5-2.7 7.8-7 10-4.3-2.2-7-5.5-7-10V6l7-3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="m9.2 12 1.8 1.8 3.9-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Therapy-support software. Not a diagnostic tool or a substitute for professional medical advice.</span>
              </p>
            </div>
          </div>
        </section>

        <section className={`${styles.overviewBridge} relative z-20 px-5 sm:px-8`}>
          <div className={`${styles.reveal} ${styles.overviewGlass} mx-auto grid max-w-7xl overflow-hidden rounded-3xl border border-white/65 sm:grid-cols-2 lg:grid-cols-4`}>
            {TRUST_ITEMS.map(({ title, detail }, index) => (
              <div
                key={title}
                className={`flex gap-3 p-5 sm:p-6 ${index > 0 ? 'border-t border-slate-200/70 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l-0 lg:border-l' : ''}`}
              >
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-800">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="relative overflow-hidden bg-slate-950 text-white">
          <div aria-hidden className="absolute inset-0">
            <div className="absolute left-[12%] top-[5%] h-80 w-80 rounded-full bg-blue-600/25 blur-[100px]" />
            <div className="absolute right-[5%] top-[38%] h-[34rem] w-[34rem] rounded-full bg-cyan-500/20 blur-[120px]" />
            <div className="absolute left-[18%] top-[58%] h-96 w-96 rounded-full bg-blue-500/15 blur-[120px]" />
            <div className="absolute right-[8%] top-[78%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-[130px]" />
          </div>

          <section className="relative z-10 px-5 py-24 sm:px-8">
            <SectionHeading
              title="One platform, two focused experiences"
              body="Patients get a clear place to practice. Clinicians get the controls and progress information needed to guide sessions."
              singleLineBody
              dark
            />
            <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
              <article className={`${styles.reveal} ${styles.liquidGlassCard} ${styles.liquidGlassCardDark} rounded-3xl p-7 md:p-9`} style={revealStyle(0)}>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white">For patients</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Focused practice without unnecessary complexity</h3>
                <ul className="mt-6 space-y-3 [&>li]:text-slate-200">
                  <CheckLine>Interactive exercises with clear instructions and immediate feedback</CheckLine>
                  <CheckLine>Readable session summaries and personal progress history</CheckLine>
                  <CheckLine>Optional clinician connection through a six-character DocID</CheckLine>
                </ul>
                <button type="button" onClick={onOpenDashboard} className="mt-7 inline-flex items-center gap-2 font-bold text-blue-200 hover:text-white">
                  Start as a patient <ArrowRightIcon className="h-4 w-4" />
                </button>
              </article>

              <article className={`${styles.reveal} ${styles.liquidGlassCard} ${styles.liquidGlassCardDark} rounded-3xl p-7 md:p-9`} style={revealStyle(80)}>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white">For clinicians</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Configure care and follow completed practice</h3>
                <ul className="mt-6 space-y-3 [&>li]:text-slate-200">
                  <CheckLine>Assign therapy modules and level playlists to connected patients</CheckLine>
                  <CheckLine>Configure exercise-specific visual and timing parameters</CheckLine>
                  <CheckLine>Review completed-session analytics and error patterns</CheckLine>
                </ul>
                <Link href="/login" className="mt-7 inline-flex items-center gap-2 font-bold text-indigo-200 hover:text-white">
                  Clinician sign in <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </article>
            </div>
          </section>

          <section id="how-it-works" className="relative z-10 scroll-mt-24 px-5 pb-24 pt-8 sm:px-8">
            <div
              aria-hidden
              className="mx-auto mb-14 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_0_18px_rgba(147,197,253,0.3)]"
            />
            <SectionHeading
              eyebrow="How it works?"
              title="From activity selection to useful progress"
              body="A consistent three-step flow keeps setup understandable while preserving detailed controls."
              dark
              underlineEyebrow
            />
            <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
              {[
                ['01', 'Choose an exercise', 'Select an activity family, module and level appropriate for the current practice goal.'],
                ['02', 'Configure the session', 'Set target size, contrast, timing, movement and other module-specific parameters.'],
                ['03', 'Review progress', 'Use completed-session summaries and longitudinal analytics to understand performance.'],
              ].map(([number, title, body], index) => (
                <article key={number} className={`${styles.reveal} ${styles.liquidGlassCard} ${styles.liquidGlassCardDark} rounded-3xl p-7`} style={revealStyle(index * 80)}>
                  <span className="text-5xl font-black tracking-tighter text-blue-200/70">{number}</span>
                  <h3 className="mt-5 text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="activities" className="relative z-10 scroll-mt-24 px-5 pb-24 pt-8 sm:px-8">
            <div
              aria-hidden
              className="mx-auto mb-14 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_0_18px_rgba(147,197,253,0.3)]"
            />
          <SectionHeading
            eyebrow="Therapy activities"
            title="Practice grouped by visual and cognitive demand"
            body="Explore activity families, then choose a module and level from the dashboard."
            dark
          />
          <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GAME_FAMILIES.map((family, index) => {
              const count = family.moduleIds.length;
              return (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => (onSelectFamily ? onSelectFamily(family.id) : onOpenDashboard())}
                  className={`${styles.reveal} ${styles.liquidGlassCard} ${styles.liquidGlassCardDark} group flex min-h-64 flex-col rounded-3xl p-7 text-left transition hover:-translate-y-1 hover:border-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300`}
                  style={revealStyle(index * 80)}
                >
                  <h3 className="text-xl font-bold text-white">{family.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">{family.body}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4">
                    <span className="text-xs font-bold text-slate-400">{count} {count === 1 ? 'activity' : 'activities'}</span>
                    <span className="flex items-center gap-1 text-sm font-bold text-blue-200">
                      Explore <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onOpenAIGaze ?? onOpenDashboard}
              className={`${styles.reveal} ${styles.liquidGlassCard} ${styles.liquidGlassCardDark} group flex min-h-64 flex-col rounded-3xl p-7 text-left transition hover:-translate-y-1 hover:border-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300`}
              style={revealStyle(GAME_FAMILIES.length * 80)}
            >
              <h3 className="text-xl font-bold text-white">AI Powered Games</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">
                AI-powered practice that adapts to how you interact during a session.
              </p>
              <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4">
                <span className="text-xs font-bold text-cyan-100">AI activities</span>
                <span className="flex items-center gap-1 text-sm font-bold text-cyan-200">
                  Explore <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </button>
          </div>
        </section>

        <section id="capabilities" className="relative z-10 scroll-mt-24 px-5 pb-24 pt-8 sm:px-8">
          <div aria-hidden className="mx-auto mb-14 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_0_18px_rgba(147,197,253,0.3)]" />
          <SectionHeading
            eyebrow="Platform capabilities"
            title="Detailed controls without a complicated experience"
            body="Kandela keeps the exercise interface focused while preserving meaningful configuration and reporting."
            dark
          />
          <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ title, body }, index) => (
              <article key={title} className={`${styles.reveal} ${styles.liquidGlassCard} ${styles.liquidGlassCardDark} rounded-3xl p-6`} style={revealStyle(index * 80)}>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="analytics" className="relative z-10 scroll-mt-24 px-5 pb-24 pt-8 sm:px-8">
          <div aria-hidden className="mx-auto mb-14 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_0_18px_rgba(147,197,253,0.3)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.85fr_1.15fr]">
            <div className={styles.reveal}>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-200 underline decoration-2 underline-offset-4">Progress analytics</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">See more than a final score</h2>
              <p className="mt-5 text-base leading-7 text-slate-300">
                Completed sessions separate correct responses from wrong taps, misses and timeouts, helping progress reviews stay clear and consistent.
              </p>
              <ul className="mt-7 space-y-3 [&>li]:text-slate-200">
                <CheckLine>Daily and longer-term progress views</CheckLine>
                <CheckLine>Accuracy and reaction-time trends</CheckLine>
                <CheckLine>Module and level filters</CheckLine>
                <CheckLine>CSV export for completed sessions</CheckLine>
              </ul>
            </div>

            <div className={`${styles.reveal} rounded-3xl border border-white bg-white p-5 text-slate-950 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.55)] sm:p-7`} style={revealStyle(80)}>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Average accuracy', '88.4%', '+6.2%'],
                  ['Average reaction', '0.92s', '-0.14s'],
                  ['Completed sessions', '24', 'Illustrative'],
                ].map(([label, value, delta]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
                    <p className="mt-1 text-xs font-bold text-emerald-700">{delta}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-950">Progress over completed sessions</p>
                    <p className="text-xs text-slate-500">Illustrative data only</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Last 8 sessions</span>
                </div>
                <svg viewBox="0 0 680 270" className="mt-6 h-auto w-full" role="img" aria-label="Illustrative accuracy and reaction time trends">
                  {[40, 95, 150, 205, 260].map((y) => (
                    <line key={y} x1="22" x2="660" y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="5 5" />
                  ))}
                  <polyline points="25,220 115,196 205,182 295,154 385,165 475,119 565,102 655,68" fill="none" stroke="#059669" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="25,62 115,77 205,91 295,116 385,127 475,155 565,174 655,196" fill="none" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="mt-3 flex flex-wrap gap-5 text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Accuracy</span>
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" />Reaction time</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="relative z-10 px-5 pb-12 pt-8 sm:px-8">
          <div aria-hidden className="mx-auto mb-14 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_0_18px_rgba(147,197,253,0.3)]" />
          <div className={`${styles.reveal} ${styles.liquidGlassCard} ${styles.liquidGlassCardDark} mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-3xl p-7 md:flex-row md:items-center md:p-10`}>
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-200 underline decoration-2 underline-offset-4">Security and privacy</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Trust starts with careful access and honest claims</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Kandela uses role-based access, secure authentication and separated patient and clinician workflows. We do not claim regulatory certification that has not been independently verified.
              </p>
            </div>
            <a href="#footer" className="shrink-0 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">
              View information
            </a>
          </div>
        </section>

        <section id="access" className="relative z-10 scroll-mt-24 px-5 pb-24 pt-8 sm:px-8">
          <div aria-hidden className="mx-auto mb-14 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_0_18px_rgba(147,197,253,0.3)]" />
          <SectionHeading
            eyebrow="Access"
            title="Flexible entry points for individuals and clinical teams"
            body="Paid billing is not enabled yet. Start with an account or use the clinical sign-in pathway for an organization-managed profile."
            dark
          />
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <article className={`${styles.reveal} rounded-3xl border border-white bg-white p-8 text-slate-950 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.55)]`}>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Individual access</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-950">Create a patient account</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">Explore available activities, complete sessions and review your own progress.</p>
              <Link href="/signup" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500">
                Create account <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </article>
            <article className={`${styles.reveal} rounded-3xl border border-white bg-white p-8 text-slate-950 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.55)]`} style={revealStyle(80)}>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Clinical teams</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-950">Organization-managed access</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">Clinician accounts are provisioned through an organization administrator.</p>
              <Link href="/login" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-900 transition hover:border-blue-400 hover:text-blue-700">
                Clinical sign in <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </article>
          </div>
        </section>

        <section id="faq" className="relative z-10 scroll-mt-24 px-5 pb-24 pt-8 sm:px-8">
          <div aria-hidden className="mx-auto mb-14 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_0_18px_rgba(147,197,253,0.3)]" />
          <SectionHeading
            eyebrow="Frequently asked questions"
            title="Clear answers before you begin"
            body="Learn how access, clinician connection, supported devices and session information work."
            dark
          />
          <div className="mx-auto max-w-3xl space-y-3">
            {FAQS.map(({ question, answer }, index) => (
              <details key={question} className={`${styles.reveal} ${styles.solidCard} group rounded-2xl px-5 py-4`} style={revealStyle(index * 80)}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                  {question}
                  <svg
                    aria-hidden
                    viewBox="0 0 20 20"
                    className="h-5 w-5 shrink-0 text-blue-200 transition duration-200 group-open:rotate-180"
                  >
                    <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <p className="mt-3 pr-8 text-sm leading-6 text-slate-300">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="relative z-10 px-5 pb-24 pt-8 sm:px-8">
          <div aria-hidden className="mx-auto mb-14 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_0_18px_rgba(147,197,253,0.3)]" />
          <div className={`${styles.reveal} ${styles.solidCard} mx-auto max-w-6xl rounded-[2rem] px-6 py-14 text-center sm:px-10 md:py-20`}>
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Start building consistent visual practice</h2>
            <p className="mx-auto mt-4 max-w-none text-base leading-7 text-slate-300 lg:whitespace-nowrap">
              Choose an activity, configure the session and turn completed practice into progress you can review.
            </p>
            <button
              type="button"
              onClick={onOpenDashboard}
              disabled={authLoading}
              aria-busy={authLoading}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 font-bold text-white transition hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-70"
            >
              {dashboardLabel} <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </section>
        </div>
      </main>

      <footer id="footer" className="relative z-10 bg-slate-950 px-5 pb-6 sm:px-8">
        <div className={`${styles.reveal} ${styles.liquidGlassCard} ${styles.liquidGlassCardDark} mx-auto max-w-7xl rounded-3xl px-6 py-10 sm:px-8`}>
          <div className="grid gap-10 border-b border-white/15 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
            <div>
              <div className="flex items-center gap-2">
                <img src="/kandela-wordmark-white.png" alt="Kandela" className="h-9 w-auto object-contain" />
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
                Interactive visual and cognitive practice with configurable sessions and measurable progress.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">Product</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-300">
                <a href="#how-it-works" className="hover:text-blue-200">How it works</a>
                <a href="#activities" className="hover:text-blue-200">Activities</a>
                <a href="#analytics" className="hover:text-blue-200">Analytics</a>
                <a href="#access" className="hover:text-blue-200">Access</a>
              </div>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">Account</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-300">
                <Link href="/signup" className="hover:text-blue-200">Create account</Link>
                <Link href="/login" className="hover:text-blue-200">Sign in</Link>
                <a href="#security" className="hover:text-blue-200">Security</a>
                <a href="#faq" className="hover:text-blue-200">FAQ</a>
              </div>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">Policies</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-300">
                <Link href="/privacy" className="hover:text-blue-200">Privacy</Link>
                <Link href="/terms" className="hover:text-blue-200">Terms</Link>
                <Link href="/clinical-disclaimer" className="hover:text-blue-200">Clinical disclaimer</Link>
                <Link href="/accessibility" className="hover:text-blue-200">Accessibility</Link>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Kandela. All rights reserved.</p>
            <p>A Measure of Light, A Measure of Progress</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
