import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type {
  AnnouncementItem,
  OrganizationSummary,
  SelfUserSummary,
  SuperAdminMetrics,
} from '@candela/shared/rn';
import { AppHeader } from '../src/components/AppHeader';
import { ScreenLoader } from '../src/components/ScreenLoader';
import {
  AlertCircleIcon,
  BuildingIcon,
  CheckIcon,
  CloseIcon,
  MegaphoneIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from '../src/components/icons';
import { ApiError, api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

type SuperAdminTab = 'overview' | 'orgs' | 'self_users' | 'announcements';

export default function SuperAdminScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { fs, s, pad } = useLayout();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>('overview');
  const [metrics, setMetrics] = useState<SuperAdminMetrics | null>(null);
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [selfUsers, setSelfUsers] = useState<SelfUserSummary[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Search filters
  const [orgFilter, setOrgFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [announcementFilter, setAnnouncementFilter] = useState('');

  // Selected Org Details Modal
  const [selectedOrg, setSelectedOrg] = useState<OrganizationSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [nextMetrics, nextOrgs, nextSelfUsers, nextAnnouncements] = await Promise.all([
        api<SuperAdminMetrics>('/api/super-admin/metrics'),
        api<OrganizationSummary[]>('/api/super-admin/organizations'),
        api<SelfUserSummary[]>('/api/super-admin/self-users'),
        api<AnnouncementItem[]>('/api/super-admin/announcements'),
      ]);
      setMetrics(nextMetrics);
      setOrgs(nextOrgs);
      setSelfUsers(nextSelfUsers);
      setAnnouncements(nextAnnouncements);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load super admin data');
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'super_admin') {
      router.replace('/login');
      return;
    }
    loadData();
  }, [loading, session, router, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleAnnouncementActive = async (id: string) => {
    try {
      await api(`/api/super-admin/announcements/${id}/toggle-active`, { method: 'PATCH' });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a)),
      );
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not update status');
    }
  };

  const handleDeleteAnnouncement = (item: AnnouncementItem) => {
    Alert.alert(
      'Delete Announcement',
      `Are you sure you want to delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/api/super-admin/announcements/${item.id}`, { method: 'DELETE' });
              setAnnouncements((prev) => prev.filter((a) => a.id !== item.id));
            } catch (err) {
              Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not delete');
            }
          },
        },
      ],
    );
  };

  const filteredOrgs = useMemo(() => {
    const q = orgFilter.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        (o.adminEmail && o.adminEmail.toLowerCase().includes(q)) ||
        (o.adminName && o.adminName.toLowerCase().includes(q)),
    );
  }, [orgs, orgFilter]);

  const filteredSelfUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return selfUsers;
    return selfUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q)),
    );
  }, [selfUsers, userFilter]);

  const filteredAnnouncements = useMemo(() => {
    const q = announcementFilter.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter(
      (a) => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q),
    );
  }, [announcements, announcementFilter]);

  if (loading || dataLoading) {
    return <ScreenLoader />;
  }

  return (
    <View style={styles.container}>
      <AppHeader />

      <View style={[styles.headerBanner, { paddingHorizontal: pad }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PLATFORM CONTROL</Text>
        </View>
        <Text style={[styles.screenTitle, { fontSize: fs(22) }]}>Golden Admin Console</Text>
        <Text style={[styles.screenSubtitle, { fontSize: fs(13) }]}>
          System-wide metrics, hospitals, self-users, and announcements
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          <Pressable
            style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
              Overview
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'orgs' && styles.tabButtonActive]}
            onPress={() => setActiveTab('orgs')}
          >
            <Text style={[styles.tabText, activeTab === 'orgs' && styles.tabTextActive]}>
              Hospitals ({orgs.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'self_users' && styles.tabButtonActive]}
            onPress={() => setActiveTab('self_users')}
          >
            <Text style={[styles.tabText, activeTab === 'self_users' && styles.tabTextActive]}>
              Self Users ({selfUsers.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'announcements' && styles.tabButtonActive]}
            onPress={() => setActiveTab('announcements')}
          >
            <Text style={[styles.tabText, activeTab === 'announcements' && styles.tabTextActive]}>
              Announcements ({announcements.length})
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[styles.contentContainer, { paddingHorizontal: pad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error ? (
          <View style={styles.errorCard}>
            <AlertCircleIcon size={20} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { fontSize: fs(16) }]}>Platform Metrics</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#e0f2fe' }]}>
                  <BuildingIcon size={22} color="#0284c7" />
                </View>
                <Text style={styles.metricValue}>{metrics?.totalOrganizations ?? orgs.length}</Text>
                <Text style={styles.metricLabel}>Total Hospitals</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#f0fdf4' }]}>
                  <UsersIcon size={22} color="#16a34a" />
                </View>
                <Text style={styles.metricValue}>{metrics?.totalDoctors ?? 0}</Text>
                <Text style={styles.metricLabel}>Active Doctors</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#fef3c7' }]}>
                  <UsersIcon size={22} color="#d97706" />
                </View>
                <Text style={styles.metricValue}>{(metrics?.totalOrgPatients ?? 0) + (metrics?.totalSelfPatients ?? 0)}</Text>
                <Text style={styles.metricLabel}>Total Patients</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#f3e8ff' }]}>
                  <MegaphoneIcon size={22} color="#9333ea" />
                </View>
                <Text style={styles.metricValue}>{announcements.filter((a) => a.isActive).length}</Text>
                <Text style={styles.metricLabel}>Active Alerts</Text>
              </View>
            </View>

            <View style={styles.quickActionsCard}>
              <Text style={styles.quickActionsTitle}>Admin Notice</Text>
              <Text style={styles.quickActionsDesc}>
                Detailed organization provisioning and doctor assignments are fully supported on desktop web. Use this mobile console for rapid oversight, status toggling, and alerts.
              </Text>
            </View>
          </View>
        )}

        {/* HOSPITALS TAB */}
        {activeTab === 'orgs' && (
          <View style={styles.section}>
            <View style={styles.searchBar}>
              <SearchIcon size={18} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search hospital name or code..."
                placeholderTextColor="#94a3b8"
                value={orgFilter}
                onChangeText={setOrgFilter}
              />
            </View>

            {filteredOrgs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No hospitals found</Text>
              </View>
            ) : (
              filteredOrgs.map((org) => (
                <Pressable
                  key={org.id}
                  style={styles.cardItem}
                  onPress={() => setSelectedOrg(org)}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{org.name}</Text>
                    <View style={styles.codeTag}>
                      <Text style={styles.codeTagText}>{org.code}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubText}>
                    Admin: {org.adminName || 'Unassigned'} ({org.adminEmail || 'No email'})
                  </Text>
                  <View style={styles.cardStatsRow}>
                    <Text style={styles.cardStatBadge}>
                      👨‍⚕️ {org.doctorCount} Doctors
                    </Text>
                    <Text style={styles.cardStatBadge}>
                      👥 {org.patientCount} Patients
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* SELF USERS TAB */}
        {activeTab === 'self_users' && (
          <View style={styles.section}>
            <View style={styles.searchBar}>
              <SearchIcon size={18} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search self-registered users..."
                placeholderTextColor="#94a3b8"
                value={userFilter}
                onChangeText={setUserFilter}
              />
            </View>

            {filteredSelfUsers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No self-registered users found</Text>
              </View>
            ) : (
              filteredSelfUsers.map((user) => (
                <View key={user.id} style={styles.cardItem}>
                  <Text style={styles.cardTitle}>{user.name}</Text>
                  <Text style={styles.cardSubText}>{user.email}</Text>
                  {user.phone ? (
                    <Text style={styles.cardSubText}>📞 {user.phone}</Text>
                  ) : null}
                  <View style={styles.cardStatsRow}>
                    <Text style={styles.cardStatBadge}>
                      Joined: {new Date(user.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === 'announcements' && (
          <View style={styles.section}>
            <View style={styles.searchBar}>
              <SearchIcon size={18} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search announcements..."
                placeholderTextColor="#94a3b8"
                value={announcementFilter}
                onChangeText={setAnnouncementFilter}
              />
            </View>

            {filteredAnnouncements.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No announcements found</Text>
              </View>
            ) : (
              filteredAnnouncements.map((ann) => (
                <View key={ann.id} style={styles.cardItem}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.annTitleWrap}>
                      <Text style={styles.cardTitle}>{ann.title}</Text>
                      <View
                        style={[
                          styles.priorityBadge,
                          ann.priority === 'critical' && styles.priorityUrgent,
                          ann.priority === 'warning' && styles.priorityWarning,
                        ]}
                      >
                        <Text style={styles.priorityText}>{ann.priority.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleToggleAnnouncementActive(ann.id)}
                      style={[
                        styles.toggleBadge,
                        ann.isActive ? styles.toggleActive : styles.toggleInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          ann.isActive ? styles.toggleTextActive : styles.toggleTextInactive,
                        ]}
                      >
                        {ann.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.annContentText}>{ann.content}</Text>
                  <Text style={styles.cardSubText}>Target: {ann.targetType}</Text>

                  <View style={styles.annFooterRow}>
                    <Text style={styles.cardSubText}>
                      Created: {new Date(ann.createdAt).toLocaleDateString()}
                    </Text>
                    <Pressable
                      style={styles.deleteIconBtn}
                      onPress={() => handleDeleteAnnouncement(ann)}
                    >
                      <TrashIcon size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Org Details Modal */}
      <Modal visible={Boolean(selectedOrg)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{selectedOrg?.name}</Text>
              <Pressable onPress={() => setSelectedOrg(null)} style={styles.closeBtn}>
                <CloseIcon size={20} color="#64748b" />
              </Pressable>
            </View>
            <Text style={styles.modalSubTitle}>Code: {selectedOrg?.code}</Text>

            <View style={styles.modalBody}>
              <Text style={styles.modalFieldLabel}>Admin Contact</Text>
              <Text style={styles.modalFieldValue}>
                {selectedOrg?.adminName || 'None'} ({selectedOrg?.adminEmail || 'No email'})
              </Text>

              <Text style={styles.modalFieldLabel}>Contact Email</Text>
              <Text style={styles.modalFieldValue}>
                {selectedOrg?.contactEmail || 'Not set'}
              </Text>

              <Text style={styles.modalFieldLabel}>Stats</Text>
              <Text style={styles.modalFieldValue}>
                Doctors: {selectedOrg?.doctorCount} | Patients: {selectedOrg?.patientCount}
              </Text>
            </View>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedOrg(null)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBanner: {
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  screenTitle: {
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  screenSubtitle: {
    color: '#64748b',
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  tabButtonActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    flex: 1,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  quickActionsCard: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  quickActionsDesc: {
    fontSize: 12,
    color: '#3b82f6',
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  cardItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  codeTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  cardSubText: {
    fontSize: 12,
    color: '#64748b',
  },
  cardStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cardStatBadge: {
    fontSize: 11,
    backgroundColor: '#f8fafc',
    color: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  annTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  priorityBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityWarning: {
    backgroundColor: '#fef3c7',
  },
  priorityUrgent: {
    backgroundColor: '#fee2e2',
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369a1',
  },
  toggleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#dcfce7',
  },
  toggleInactive: {
    backgroundColor: '#f1f5f9',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#15803d',
  },
  toggleTextInactive: {
    color: '#64748b',
  },
  annContentText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  annFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  deleteIconBtn: {
    padding: 4,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  modalSubTitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: -8,
  },
  modalBody: {
    gap: 6,
    marginVertical: 4,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  modalFieldValue: {
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 6,
  },
  modalCloseButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
