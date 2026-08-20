import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRef } from 'react';
import {
  AnalyticsIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  BeePathIcon,
  EyeIcon,
  GeoboardIcon,
  MobileTargetIcon,
  MonitorIcon,
  PuzzleIcon,
  RocketIcon,
  RotatoryIcon,
  SlidersIcon,
  SparklesIcon,
  TargetIcon,
  ZapIcon,
} from './icons';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';

const MODULES = [
  {
    id: 'wheel',
    title: 'Rotatory Module',
    body: 'Rotational target tracking with custom speeds and alphabet/number/color modes.',
    badge: 'For Tabs',
    accent: '#2563EB',
    bg: '#EFF6FF',
    Icon: RotatoryIcon,
  },
  {
    id: 'sorting',
    title: 'Sorting Module',
    body: 'Visual discrimination and sequential target recognition drills.',
    badge: 'For Tabs & Mobile',
    accent: '#7C3AED',
    bg: '#F5F3FF',
    Icon: PuzzleIcon,
  },
  {
    id: 'tracing',
    title: 'Bee Path Tracing',
    body: 'Smooth pursuit path control & motor-visual coordination.',
    badge: 'For Touch & Stylus',
    accent: '#D97706',
    bg: '#FFFBEB',
    Icon: BeePathIcon,
  },
  {
    id: 'pursuit',
    title: 'Pursuit Module',
    body: 'Continuous smooth pursuit tracking with full customizable velocity controls.',
    badge: 'For All Devices',
    accent: '#0891B2',
    bg: '#ECFEFF',
    Icon: TargetIcon,
  },
  {
    id: 'mobile_target',
    title: 'Bubble Chase',
    body: '2-target bouncing pursuit & dark field tracking.',
    badge: 'For Mobile & Tabs',
    accent: '#059669',
    bg: '#ECFDF5',
    Icon: MobileTargetIcon,
  },
  {
    id: 'geoboard',
    title: 'Draw a Pattern',
    body: 'Five pattern boards for visual-motor integration & spatial recall.',
    badge: 'For All Devices',
    accent: '#0D9488',
    bg: '#F0FDFA',
    Icon: GeoboardIcon,
  },
] as const;

export function HomePageContent({
  onOpenDashboard,
  onSelectModule,
}: {
  onOpenDashboard: () => void;
  onSelectModule?: (moduleId: string) => void;
}) {
  const { fs, s, pad, columns, width } = useLayout();
  const featuresY = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const cardWidth =
    columns === 1
      ? width - pad * 2
      : (width - pad * 2 - s(12) * (Math.min(columns, 2) - 1)) / Math.min(columns, 2);

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.page }} contentContainerStyle={{ paddingBottom: s(24) }}>
      <View style={{ backgroundColor: colors.slate, paddingHorizontal: pad, paddingVertical: s(40) }}>
        <View
          style={{
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(6),
            backgroundColor: 'rgba(59,130,246,0.2)',
            borderColor: 'rgba(96,165,250,0.3)',
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: s(12),
            paddingVertical: s(6),
            marginBottom: s(16),
          }}
        >
          <SparklesIcon size={s(14)} color="#93C5FD" />
          <Text style={{ color: '#93C5FD', fontSize: fs(10), fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
            A Measure of Light, A Measure of Progress
          </Text>
        </View>
        <Text style={{ color: colors.white, fontSize: fs(32), fontWeight: '900', textAlign: 'center', lineHeight: fs(38) }}>
          Precision Visual & Cognitive Therapy Tools
        </Text>
        <Text style={{ color: '#D1D5DB', fontSize: fs(15), textAlign: 'center', marginTop: s(12), lineHeight: fs(22) }}>
          Scientifically formulated visual pursuit, ocular motor tracking, and visual discrimination modules designed for clinical accuracy and patient engagement.
        </Text>
        <View style={{ marginTop: s(20), gap: s(10) }}>
          <Pressable
            onPress={onOpenDashboard}
            style={{
              backgroundColor: colors.blue,
              borderRadius: s(16),
              paddingVertical: s(14),
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: s(8),
            }}
          >
            <RocketIcon size={s(18)} color="#fff" />
            <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(15) }}>Explore Dashboard</Text>
          </Pressable>
          <Pressable
            onPress={() => scrollRef.current?.scrollTo({ y: featuresY.current, animated: true })}
            style={{
              borderRadius: s(16),
              paddingVertical: s(14),
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: s(8),
            }}
          >
            <Text style={{ color: colors.white, fontWeight: '600', fontSize: fs(15) }}>Learn Capabilities</Text>
            <ArrowDownIcon size={s(16)} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: pad, marginTop: -s(24), flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
        {MODULES.map((mod) => (
          <Pressable
            key={mod.id}
            onPress={() => (onSelectModule ? onSelectModule(mod.id) : onOpenDashboard())}
            style={{
              width: cardWidth,
              backgroundColor: colors.white,
              borderRadius: s(16),
              padding: s(16),
              borderWidth: 1,
              borderColor: colors.border,
              justifyContent: 'space-between',
              minHeight: s(160),
            }}
          >
            <View>
              <View
                style={{
                  width: s(40),
                  height: s(40),
                  borderRadius: s(12),
                  backgroundColor: mod.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: s(10),
                }}
              >
                <mod.Icon size={s(22)} color={mod.accent} />
              </View>
              <Text style={{ fontSize: fs(16), fontWeight: '700', color: colors.text }}>{mod.title}</Text>
              <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(4), lineHeight: fs(17) }}>{mod.body}</Text>
            </View>
            <View
              style={{
                marginTop: s(12),
                paddingTop: s(10),
                borderTopWidth: 1,
                borderTopColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: fs(10),
                  fontWeight: '700',
                  color: mod.accent,
                  backgroundColor: mod.bg,
                  paddingHorizontal: s(8),
                  paddingVertical: s(3),
                  borderRadius: s(6),
                  overflow: 'hidden',
                }}
              >
                {mod.badge}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: fs(12), fontWeight: '700', color: mod.accent }}>Launch</Text>
                <ArrowRightIcon size={s(12)} color={mod.accent} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <View
        onLayout={(e) => {
          featuresY.current = e.nativeEvent.layout.y;
        }}
        style={{ paddingHorizontal: pad, paddingVertical: s(40) }}
      >
        <Text style={{ fontSize: fs(24), fontWeight: '800', color: colors.text, textAlign: 'center' }}>
          Therapy Platform Capabilities
        </Text>
        <Text style={{ fontSize: fs(14), color: '#4B5563', textAlign: 'center', marginTop: s(8), marginBottom: s(24) }}>
          Designed for clinical flexibility, custom patient sessions, and detailed performance tracking.
        </Text>
        {[
          {
            title: 'Customizable Parameters',
            body: 'Adjust speeds, contrast levels, target sizes, rotation directions, and pattern shapes tailored to specific therapy requirements.',
            bg: '#DBEAFE',
            color: '#2563EB',
            Icon: SlidersIcon,
          },
          {
            title: 'Session Analytics',
            body: 'Capture detailed timing logs, accuracy scores, round durations, and export CSV reports directly after each exercise session.',
            bg: '#D1FAE5',
            color: '#059669',
            Icon: AnalyticsIcon,
          },
          {
            title: 'Cross-Platform Ready',
            body: 'Optimized for desktop touch monitors, tablets, and full-screen clinical setups with responsive visual scaling.',
            bg: '#EDE9FE',
            color: '#7C3AED',
            Icon: MonitorIcon,
          },
        ].map((item) => (
          <View
            key={item.title}
            style={{
              backgroundColor: colors.white,
              borderRadius: s(16),
              padding: s(20),
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: s(12),
            }}
          >
            <View
              style={{
                width: s(44),
                height: s(44),
                borderRadius: s(12),
                backgroundColor: item.bg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: s(10),
              }}
            >
              <item.Icon size={s(22)} color={item.color} />
            </View>
            <Text style={{ fontSize: fs(18), fontWeight: '700', color: colors.text, marginBottom: s(6) }}>{item.title}</Text>
            <Text style={{ fontSize: fs(13), color: '#4B5563', lineHeight: fs(20) }}>{item.body}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: colors.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: pad }}>
        <Text
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8',
            fontSize: fs(11),
            fontWeight: '600',
            paddingHorizontal: s(8),
            paddingVertical: s(4),
            borderRadius: s(6),
            overflow: 'hidden',
            textTransform: 'uppercase',
          }}
        >
          Content Placeholder
        </Text>
        <Text style={{ fontSize: fs(22), fontWeight: '700', color: colors.text, marginTop: s(10) }}>
          Personalized Rehabilitation Workflows
        </Text>
        <Text style={{ fontSize: fs(13), color: '#4B5563', marginTop: s(8), lineHeight: fs(20) }}>
          [Placeholder content: Detailed information regarding therapy protocols, patient progress charts, and clinical guidance notes can be placed here.]
        </Text>
        <View style={{ flexDirection: 'row', marginTop: s(16), gap: s(16) }}>
          {[
            ['4+', 'Core Therapy Modules'],
            ['100%', 'Configurable Sessions'],
            ['Instant', 'CSV Export'],
          ].map(([stat, label]) => (
            <View key={label} style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(20), fontWeight: '800', color: colors.blue }}>{stat}</Text>
              <Text style={{ fontSize: fs(11), color: colors.muted, fontWeight: '500' }}>{label}</Text>
            </View>
          ))}
        </View>
        <View
          style={{
            marginTop: s(20),
            borderRadius: s(16),
            backgroundColor: colors.navy,
            padding: s(24),
            alignItems: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: s(8) }}>
            <EyeIcon size={s(32)} color="#BFDBFE" />
            <ZapIcon size={s(20)} color="#FCD34D" />
          </View>
          <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(18) }}>Kandela Therapy</Text>
          <Text style={{ color: '#DBEAFE', fontSize: fs(12), marginTop: s(4) }}>Interactive Vision Exercises</Text>
          <Pressable
            onPress={onOpenDashboard}
            style={{
              marginTop: s(16),
              backgroundColor: colors.white,
              borderRadius: s(12),
              paddingHorizontal: s(16),
              paddingVertical: s(10),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
            }}
          >
            <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: fs(12) }}>Go to Dashboard</Text>
            <ArrowRightIcon size={s(12)} color="#1D4ED8" />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: pad, paddingVertical: s(32) }}>
        <View style={{ backgroundColor: colors.blue, borderRadius: s(24), padding: s(28), alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: fs(22), fontWeight: '800', textAlign: 'center' }}>
            Ready to start your session?
          </Text>
          <Text style={{ color: '#DBEAFE', fontSize: fs(13), textAlign: 'center', marginTop: s(8), marginBottom: s(20) }}>
            Access all vision therapy modules, configure session preferences, and track progress from the main dashboard.
          </Text>
          <Pressable
            onPress={onOpenDashboard}
            style={{
              backgroundColor: colors.white,
              borderRadius: s(12),
              paddingHorizontal: s(20),
              paddingVertical: s(12),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
            }}
          >
            <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: fs(14) }}>Open Games Dashboard</Text>
            <ArrowRightIcon size={s(14)} color="#1D4ED8" />
          </Pressable>
        </View>
      </View>

      <View style={{ backgroundColor: colors.slate, padding: pad, alignItems: 'center' }}>
        <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(13) }}>Kandela</Text>
        <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginTop: s(4) }}>— A Measure of Light, A Measure of Progress</Text>
        <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginTop: s(8) }}>
          © {new Date().getFullYear()} Kandela Platform. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}
