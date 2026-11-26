'use client';

import { useEffect } from 'react';
import {
  ArrowLeftRight,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  UserCircle,
  Users,
} from 'lucide-react';
import type { DoctorOrganizationMembershipView } from '@candela/shared';
import { AnalyticsIcon } from '@/components/icons/VectorIcons';
import { CopyButton } from '@/components/ui/CopyButton';
import styles from './DoctorDashboard.module.css';

export type DoctorSection =
  | 'overview'
  | 'patients'
  | 'prescriptions'
  | 'transfers'
  | 'analytics'
  | 'account';

interface DoctorSidebarProps {
  activeSection: DoctorSection;
  pendingTransferCount: number;
  doctorName: string;
  referralCode?: string | null;
  activeMemberships: DoctorOrganizationMembershipView[];
  selectedOrganizationId: string;
  onSelectOrganization: (organizationId: string) => void;
  onSelectSection: (section: DoctorSection) => void;
  onSignOut: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function SidebarToggleGlyph({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className="size-[19px] shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      {expanded ? <rect x="4" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" /> : null}
    </svg>
  );
}

function doctorInitials(name: string): string {
  const cleaned = name.trim().replace(/^dr\.?\s+/i, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDoctorDisplayName(name: string): string {
  const cleaned = name.trim().replace(/^dr\.?\s+/i, '');
  return cleaned ? `Dr. ${cleaned}` : 'Doctor';
}

export function DoctorSidebar({
  activeSection,
  pendingTransferCount,
  doctorName,
  referralCode,
  activeMemberships,
  selectedOrganizationId,
  onSelectOrganization,
  onSelectSection,
  onSignOut,
  expanded,
  onToggleExpanded,
  mobileOpen,
  onCloseMobile,
}: DoctorSidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseMobile();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const primaryNav: Array<{
    id: DoctorSection;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }> = [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'patients', label: 'My Patients', icon: Users },
      { id: 'prescriptions', label: 'Prescriptions', icon: ClipboardList },
      {
        id: 'transfers',
        label: 'Transfers',
        icon: ArrowLeftRight,
        badge: pendingTransferCount > 0 ? pendingTransferCount : undefined,
      },
    ];

  const handleNav = (section: DoctorSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const renderSidebarBody = (isCollapsed: boolean) => {
    const activeClinic =
      activeMemberships.find((m) => m.organizationId === selectedOrganizationId) ??
      activeMemberships[0] ??
      null;

    return (
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="space-y-4">
          {/* Top row: Desktop collapse toggle OR mobile drawer close toggle in the same top-left spot */}
          <div
            className={`flex items-center gap-2 ${
              isCollapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={expanded}
              data-tooltip={isCollapsed ? 'Expand sidebar' : undefined}
              title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              className={`hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-[var(--doc-muted)] transition hover:bg-[var(--doc-primary-soft)] hover:text-[var(--doc-primary)] focus-visible:outline-2 focus-visible:outline-[var(--doc-primary)] lg:flex ${
                isCollapsed ? styles.collapsedTooltip : ''
              }`}
            >
              <SidebarToggleGlyph expanded={expanded} />
            </button>

            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100/80 lg:hidden"
            >
              <SidebarToggleGlyph expanded={true} />
            </button>
          </div>

          {/* Doctor Identity & Prominent DocID */}
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              {referralCode ? (
                <div
                  data-tooltip={`${formatDoctorDisplayName(doctorName)} · DocID ${referralCode}`}
                  className={`${styles.collapsedTooltip} flex w-[48px] flex-col items-center gap-1 rounded-[10px] bg-[var(--doc-primary-soft)] py-1.5`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--doc-primary)]">
                    DocID
                  </span>
                  <CopyButton
                    text={referralCode}
                    label="DocID"
                    iconSize={14}
                    className="text-[var(--doc-primary)] hover:bg-white/80 hover:text-[var(--doc-primary-hover)]"
                  />
                </div>
              ) : (
                <div
                  data-tooltip={formatDoctorDisplayName(doctorName)}
                  className={`${styles.collapsedTooltip} flex size-[40px] items-center justify-center rounded-[10px] bg-[var(--doc-primary-soft)] text-[12px] font-bold text-[var(--doc-primary)]`}
                >
                  {doctorInitials(doctorName)}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[13px] bg-[var(--doc-primary-soft)]/65 p-3">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--doc-primary)] text-[11px] font-bold text-white"
                >
                  {doctorInitials(doctorName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight text-[var(--doc-text)]">
                    {formatDoctorDisplayName(doctorName)}
                  </p>
                  {activeClinic && activeMemberships.length === 1 && (
                    <p className="mt-0.5 truncate text-[11px] text-[var(--doc-muted)]">
                      {activeClinic.organizationName}
                    </p>
                  )}
                </div>
              </div>

              {referralCode && (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[10px] bg-white px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--doc-primary)]">
                      DocID
                    </p>
                    <p
                      className="truncate text-[17px] font-bold leading-tight tracking-[0.12em] tabular-nums text-[var(--doc-text)] select-all"
                      title={`Your DocID: ${referralCode}`}
                    >
                      {referralCode}
                    </p>
                  </div>
                  <CopyButton
                    text={referralCode}
                    label="DocID"
                    iconSize={15}
                    className="size-8 shrink-0 rounded-lg bg-[var(--doc-surface-subtle)] text-[var(--doc-primary)] hover:bg-[var(--doc-primary-soft)] hover:text-[var(--doc-primary-hover)]"
                  />
                </div>
              )}

              {activeMemberships.length > 1 && (
                <label className="mt-2.5 block">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--doc-muted)]">
                    <Building2 className="size-3" />
                    Clinic context
                  </span>
                  <select
                    aria-label="Active clinic for new patients"
                    value={selectedOrganizationId}
                    onChange={(e) => onSelectOrganization(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--doc-border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--doc-text)] focus:border-[var(--doc-primary)] focus:outline-none"
                  >
                    {activeMemberships.map((membership) => (
                      <option key={membership.organizationId} value={membership.organizationId}>
                        {membership.organizationName}
                        {membership.isPrimary ? ' (Primary)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* Primary Navigation: Workspace */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--doc-muted-soft)]">
                Workspace
              </p>
            )}
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={
                    item.badge !== undefined ? `${item.label} (${item.badge} pending)` : item.label
                  }
                  data-tooltip={
                    isCollapsed
                      ? item.badge !== undefined
                        ? `${item.label} (${item.badge})`
                        : item.label
                      : undefined
                  }
                  className={`${styles.navItem} ${isCollapsed ? `${styles.navItemCollapsed} ${styles.collapsedTooltip}` : ''
                    } ${active ? styles.navItemActive : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-[17px] shrink-0" strokeWidth={1.9} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {item.badge !== undefined &&
                    (isCollapsed ? (
                      <span
                        aria-hidden
                        className="absolute right-1.5 top-1.5 flex size-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                      />
                    ) : (
                      <span
                        className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${active
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--doc-primary-soft)] text-[var(--doc-primary)]'
                          }`}
                      >
                        {item.badge}
                      </span>
                    ))}
                </button>
              );
            })}
          </div>

          {/* Secondary Navigation: Insights & Account */}
          <div className="space-y-1 border-t border-[var(--doc-border)] pt-3">
            {!isCollapsed && (
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--doc-muted-soft)]">
                Insights &amp; Account
              </p>
            )}
            <button
              type="button"
              onClick={() => handleNav('analytics')}
              aria-current={activeSection === 'analytics' ? 'page' : undefined}
              aria-label="Analytics"
              data-tooltip={isCollapsed ? 'Analytics' : undefined}
              className={`${styles.navItem} ${isCollapsed ? `${styles.navItemCollapsed} ${styles.collapsedTooltip}` : ''
                } ${activeSection === 'analytics' ? styles.navItemActive : ''}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <AnalyticsIcon className="size-[17px] shrink-0" strokeWidth={1.9} />
                {!isCollapsed && <span className="truncate">Analytics</span>}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('account')}
              aria-current={activeSection === 'account' ? 'page' : undefined}
              aria-label="My Profile"
              data-tooltip={isCollapsed ? 'My Profile' : undefined}
              className={`${styles.navItem} ${isCollapsed ? `${styles.navItemCollapsed} ${styles.collapsedTooltip}` : ''
                } ${activeSection === 'account' ? styles.navItemActive : ''}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <UserCircle className="size-[17px] shrink-0" strokeWidth={1.9} />
                {!isCollapsed && <span className="truncate">My Profile</span>}
              </span>
            </button>
          </div>
        </div>

        {/* Footer Sign out */}
        <div className="border-t border-[var(--doc-border)] pt-3">
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            data-tooltip={isCollapsed ? 'Sign out' : undefined}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] text-[13px] font-semibold text-[var(--doc-error-text)] transition hover:bg-[var(--doc-error-bg)] focus-visible:outline-2 focus-visible:outline-[var(--doc-primary)] ${isCollapsed
              ? `${styles.navItemCollapsed} ${styles.collapsedTooltip}`
              : 'px-3 py-2.5'
              }`}
          >
            <LogOut className="size-[17px] shrink-0" strokeWidth={1.9} />
            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop persistent collapsible chipped-off sidebar */}
      <aside
        className={`${styles.sidebar} ${styles.sidebarDesktop} ${
          expanded
            ? `${styles.sidebarExpanded} p-[13px]`
            : `${styles.sidebarCollapsed} px-[10px] py-[13px]`
        } hidden lg:sticky lg:top-[13px] lg:mb-[13px] lg:ml-[13px] lg:flex lg:h-[calc(100dvh-26px)]`}
      >
        <nav aria-label="Doctor navigation" className="h-full">
          {renderSidebarBody(!expanded)}
        </nav>
      </aside>

      {/* Tablet / Mobile slide-over drawer matching User login behavior */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          aria-label="Close menu"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        aria-hidden={!mobileOpen ? true : undefined}
        className={`${styles.sidebar} fixed inset-y-0 left-0 z-50 flex h-dvh w-[244px] max-w-[82vw] overflow-y-auto p-[13px] transition-transform duration-200 ease-out motion-reduce:transition-none lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <nav aria-label="Doctor navigation" className="h-full">
          {renderSidebarBody(false)}
        </nav>
      </aside>
    </>
  );
}
