import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl
} from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { VictoryAxis, VictoryBar, VictoryChart, VictoryLine, VictoryTheme } from 'victory-native';

import COLORS from './theme/colors';
import { SessionProvider, useSession } from './context/SessionContext';
import { loginUser, getDashboardSummary } from './api/auth';
import {
  fetchJobs,
  createJob,
  completeJob,
  pauseJob,
  resumeJob,
  completeQc
} from './api/jobs';
import { fetchSettings } from './api/settings';
import { searchVehicles } from './api/vehicles';
import { fetchReports } from './api/reports';

const DEFAULT_LOCAL_BASE = null;

const KEYPAD_LAYOUT = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'delete']
];

const Tab = createBottomTabNavigator();

const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    card: COLORS.panelSoft,
    border: COLORS.border,
    text: COLORS.textPrimary,
    primary: COLORS.accent
  }
};

const STATUS_COLORS = {
  'In Progress': COLORS.accent,
  Paused: COLORS.warning,
  'QC Required': COLORS.warning,
  Completed: COLORS.success,
  default: COLORS.textSecondary
};

const extractHost = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  try {
    const url = value.startsWith('http') ? new URL(value) : new URL(`http://${value}`);
    return url.hostname || null;
  } catch {
    return value.split(':')[0] || null;
  }
};

const resolveRuntimeHost = () => {
  const { SourceCode } = NativeModules;
  const scriptURL = SourceCode?.scriptURL;
  const expoHost =
    Constants.expoConfig?.hostUri ||
    Constants.expoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;

  return (
    extractHost(scriptURL) ||
    extractHost(expoHost) ||
    null
  );
};

const RUNTIME_HOST = resolveRuntimeHost();
const RUNTIME_API_BASE = (__DEV__ && RUNTIME_HOST) ? `http://${RUNTIME_HOST}:5051` : null;

const EXPO_CONFIG_BASE = Constants.expoConfig?.extra?.apiBaseUrl;
const MANIFEST2_BASE = Constants.manifest2?.extra?.expoClient?.extra?.apiBaseUrl;
const CLASSIC_MANIFEST_BASE = Constants.manifest?.extra?.apiBaseUrl;

const DEFAULT_API_BASE =
  (EXPO_CONFIG_BASE && EXPO_CONFIG_BASE.trim()) ||
  (MANIFEST2_BASE && MANIFEST2_BASE.trim()) ||
  (CLASSIC_MANIFEST_BASE && CLASSIC_MANIFEST_BASE.trim && CLASSIC_MANIFEST_BASE.trim()) ||
  RUNTIME_API_BASE ||
  DEFAULT_LOCAL_BASE ||
  '';

function formatElapsedMinutes(startTime) {
  if (!startTime) {
    return 'Just started';
  }
  const started = new Date(startTime);
  if (Number.isNaN(started.getTime())) {
    return 'Just started';
  }
  const diffMs = Date.now() - started.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return 'Just started';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  }
  return `${hours}h ${remaining}m ago`;
}

function computeMetricValue(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'number') {
    return `${value}`;
  }
  return String(value);
}

function normalizeString(value) {
  return value ? String(value).trim().toLowerCase() : '';
}

function jobMatchesSalesperson(job, user) {
  if (!job || !user) return false;
  const name = normalizeString(user.name);
  const employeeNumber = normalizeString(user.employeeNumber);
  const userId = normalizeString(user.id);

  const candidates = [
    job.salesPerson,
    job.salesperson,
    job.salesPersonName,
    job.salespersonName,
    job.salesPersonId,
    job.salespersonId,
    job.salesPersonEmail,
    job.salespersonEmail
  ]
    .filter(Boolean)
    .map(normalizeString);

  if (candidates.some((candidate) => candidate && (candidate === name || candidate === employeeNumber || candidate === userId))) {
    return true;
  }

  if (name && candidates.some((candidate) => candidate && candidate.includes(name))) {
    return true;
  }

  return false;
}

function jobCompletedOn(job, targetDate) {
  if (!job || !targetDate) return false;
  const date = job.completedAt || job.endTime || job.startTime || job.createdAt;
  if (!date) return false;
  const jobDate = new Date(date);
  if (Number.isNaN(jobDate.getTime())) return false;
  return jobDate.toISOString().slice(0, 10) === targetDate.toISOString().slice(0, 10);
}

function jobWithinRange(job, startDate, endDate) {
  if (!job) return false;
  const date = job.completedAt || job.endTime || job.startTime || job.createdAt;
  if (!date) return false;
  const jobDate = new Date(date);
  if (Number.isNaN(jobDate.getTime())) return false;
  return jobDate >= startDate && jobDate <= endDate;
}

function getSalesStatusStyles(status) {
  const normalized = normalizeString(status);
  if (normalized.includes('progress')) {
    return {
      backgroundColor: `${COLORS.accent}22`,
      borderColor: COLORS.accent,
      color: COLORS.accent
    };
  }
  if (normalized.includes('qc')) {
    return {
      backgroundColor: `${COLORS.warning}22`,
      borderColor: COLORS.warning,
      color: COLORS.warning
    };
  }
  if (normalized.includes('complete')) {
    return {
      backgroundColor: `${COLORS.success}22`,
      borderColor: COLORS.success,
      color: COLORS.success
    };
  }
  return {
    backgroundColor: `${COLORS.textSecondary}22`,
    borderColor: COLORS.border,
    color: COLORS.textSecondary
  };
}

function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [dashboardRefreshSignal, setDashboardRefreshSignal] = useState(0);

  const hiddenInputRef = useRef(null);
  const lastAttemptedPin = useRef(null);

  const normalizedApiBase = useMemo(() => {
    const trimmed = (apiBaseUrl || '').trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }, [apiBaseUrl]);

  const isAuthenticated = Boolean(session);

  const identifiers = useMemo(() => {
    const idValues = [
      session?.user?.id,
      session?.user?.employeeNumber,
      session?.user?.pin,
      session?.user?.employeeId,
      session?.user?.email
    ];
    return idValues.filter(Boolean).map(value => String(value));
  }, [session]);

  const updateConnectionStatus = useCallback(async () => {
    if (!normalizedApiBase) {
      setConnectionStatus('idle');
      return;
    }

    setConnectionStatus('checking');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`${normalizedApiBase}/api/v2/health`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeout);
      setConnectionStatus(response.ok ? 'reachable' : 'error');
    } catch (err) {
      setConnectionStatus('error');
    }
  }, [normalizedApiBase]);

  useEffect(() => {
    updateConnectionStatus();
  }, [normalizedApiBase, updateConnectionStatus]);

  useEffect(() => {
    if (pin.length === 4 && !loading && !isAuthenticated && lastAttemptedPin.current !== pin) {
      attemptLogin(pin, { auto: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, loading, isAuthenticated]);

  const handlePinChange = (value) => {
    const sanitized = (value || '').replace(/[^0-9]/g, '').slice(0, 8);
    setPin(sanitized);
    if (error) setError('');
    lastAttemptedPin.current = null;
  };

  const handleKeypadPress = (key) => {
    if (loading) return;

    if (key === 'clear') {
      setPin('');
      setError('');
      lastAttemptedPin.current = null;
      return;
    }

    if (key === 'delete') {
      setPin((prev) => prev.slice(0, -1));
      setError('');
      lastAttemptedPin.current = null;
      return;
    }

    if (pin.length >= 8) {
      return;
    }

    const next = `${pin}${key}`;
    setPin(next);
    if (error) setError('');
  };

  const triggerDashboardRefresh = useCallback(() => {
    setDashboardRefreshSignal((current) => current + 1);
  }, []);

  const attemptLogin = async (pinValue, { auto = false } = {}) => {
    const candidatePin = (pinValue || pin || '').trim();

    if (!normalizedApiBase) {
      setError('Enter the Cleanup Tracker API base URL.');
      return;
    }

    if (!candidatePin) {
      setError('Enter your access PIN.');
      return;
    }

    if (candidatePin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice(null);
    lastAttemptedPin.current = candidatePin;

    try {
      const data = await loginUser({
        baseUrl: normalizedApiBase,
        employeeId: employeeId.trim(),
        pin: candidatePin
      });

      setSession(data);
      setNotice({
        type: 'success',
        text: `Welcome back, ${data.user?.name || 'team member'}`
      });
      setPin('');
      lastAttemptedPin.current = null;
      triggerDashboardRefresh();
    } catch (err) {
      const messageFromServer = err.response?.data?.error;
      if (messageFromServer) {
        setError(messageFromServer);
      } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Network error. Confirm the Cleanup Tracker API is reachable from this device or update the workspace URL in Settings.');
      } else {
        setError(err.message || 'Login failed');
      }

      if (!auto) {
        setPin('');
      }
      lastAttemptedPin.current = candidatePin;
    } finally {
      setLoading(false);
    }
  };

  const resetSession = useCallback(() => {
    setSession(null);
    setPin('');
    setNotice({ type: 'info', text: 'Signed out.' });
  }, []);

  const contextValue = useMemo(() => ({
    baseUrl: normalizedApiBase,
    rawBaseUrl: apiBaseUrl,
    updateBaseUrl: setApiBaseUrl,
    session,
    identifiers,
    signOut: resetSession,
    notice,
    setNotice,
    connectionStatus,
    checkConnectivity: updateConnectionStatus,
    triggerDashboardRefresh,
    dashboardRefreshSignal
  }), [
    normalizedApiBase,
    apiBaseUrl,
    session,
    identifiers,
    resetSession,
    notice,
    connectionStatus,
    updateConnectionStatus,
    triggerDashboardRefresh,
    dashboardRefreshSignal
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient colors={['#020308', COLORS.background]} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="light" />
          {!isAuthenticated ? (
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView
                contentContainerStyle={styles.authContainer}
                keyboardShouldPersistTaps="handled"
              >
                <BrandHeader />
                <LoginPanel
                  pin={pin}
                  onPinChange={handlePinChange}
                  onKeypadPress={handleKeypadPress}
                  onSubmit={() => attemptLogin(pin, { auto: false })}
                  loading={loading}
                  connectionStatus={connectionStatus}
                  statusText={getStatusText(connectionStatus, normalizedApiBase)}
                  error={error}
                  notice={notice}
                  hiddenInputRef={hiddenInputRef}
                  onInputPress={() => hiddenInputRef.current?.focus()}
                />

                <TextInput
                  ref={hiddenInputRef}
                  style={styles.hiddenInput}
                  value={pin}
                  onChangeText={handlePinChange}
                  keyboardType="number-pad"
                  importantForAutofill="no"
                  caretHidden
                  autoCorrect={false}
                  autoFocus={false}
                  maxLength={8}
                />

                <ConnectionSettingsCard
                  apiBaseUrl={apiBaseUrl}
                  onChangeBaseUrl={setApiBaseUrl}
                  employeeId={employeeId}
                  onChangeEmployeeId={setEmployeeId}
                  connectionStatus={connectionStatus}
                  onRecheck={updateConnectionStatus}
                />
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            <SessionProvider value={contextValue}>
              <AuthenticatedApp />
            </SessionProvider>
          )}
        </SafeAreaView>
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

function getStatusText(status, baseUrl) {
  switch (status) {
    case 'checking':
      return baseUrl ? `Checking connectivity to ${baseUrl}…` : 'Checking API connectivity…';
    case 'reachable':
      return `Connected to ${baseUrl}`;
    case 'error':
      return baseUrl ? 'API not reachable. Verify the workspace URL or try again.' : 'Set your workspace API URL to continue.';
    default:
      return baseUrl ? 'Enter your Cleanup Tracker PIN to sign in.' : 'Provide your workspace API URL to link this device.';
  }
}

function BrandHeader() {
  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandMark}>
        <Ionicons name="sparkles-outline" size={22} color={COLORS.textPrimary} />
      </View>
      <View>
        <Text style={styles.brandTitle}>CleanUp Track</Text>
        {/* Intentionally no subtitle - keep branding minimal */}
      </View>
    </View>
  );
}

function LoginPanel({
  pin,
  onPinChange,
  onKeypadPress,
  onSubmit,
  loading,
  connectionStatus,
  statusText,
  error,
  notice,
  hiddenInputRef,
  onInputPress
}) {
  return (
    <View style={styles.loginCard}>
      <LinearGradient
        colors={[COLORS.accentAlt, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loginCardAccent}
        pointerEvents="none"
      />

      <View style={styles.loginCardHeader}>
        {/* Replace the previous workspace link wording with the CleanUp Track branding */}
        <BrandHeader />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {notice ? (
        <View
          style={[
            styles.noticeBanner,
            notice.type === 'success' && styles.noticeBannerSuccess
          ]}
        >
          <Ionicons
            name={notice.type === 'success' ? 'checkmark-circle' : 'information-circle'}
            size={18}
            color={COLORS.textPrimary}
          />
          <Text style={styles.noticeText}>{notice.text}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.pinPanel}
        onPress={onInputPress}
      >
        <View style={styles.pinBoxes}>
          {[0, 1, 2, 3].map((index) => {
            const filled = Boolean(pin[index]);
            return (
              <View
                key={index}
                style={[styles.pinBox, filled && styles.pinBoxFilled]}
              >
                {filled ? (
                  <View style={styles.pinDot} />
                ) : (
                  <Text style={styles.pinHintNumber}>{index + 1}</Text>
                )}
              </View>
            );
          })}
        </View>
        <Text style={styles.pinHint}>Enter your 4-digit access PIN</Text>
      </TouchableOpacity>

      <View style={styles.keypad}>
        {KEYPAD_LAYOUT.map((row) => (
          <View key={row.join('-')} style={styles.keypadRow}>
            {row.map((key) => (
              <KeypadButton
                key={key}
                label={key}
                onPress={() => onKeypadPress(key)}
                disabled={loading}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Removed inline 'Link Workspace' button and connection status from login UI per UX request. */}
    </View>
  );
}

function KeypadButton({ label, onPress, disabled }) {
  const isAction = label === 'clear' || label === 'delete';
  const displayValue = label === 'clear' ? '✕' : label === 'delete' ? '⌫' : label;
  const gradientColors = (() => {
    if (label === 'clear') return ['#7f1d1d', '#b91c1c'];
    if (label === 'delete') return ['#b45309', '#fb923c'];
    return ['#242932', '#1a1f27'];
  })();

  return (
    <TouchableOpacity
      style={[styles.keypadButtonWrapper, disabled && styles.keypadButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.keypadButton,
          isAction ? styles.keypadButtonAction : styles.keypadButtonDigit
        ]}
      >
        <Text style={styles.keypadButtonLabel}>{displayValue}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ConnectionSettingsCard({
  apiBaseUrl,
  onChangeBaseUrl,
  employeeId,
  onChangeEmployeeId,
  connectionStatus,
  onRecheck
}) {
  return (
    <View style={styles.connectionCard}>
      <Text style={styles.sectionHeading}>Connection Settings</Text>
      <Text style={styles.sectionSubheading}>
        Align this device with your Cleanup Tracker workspace. Enter the same API base URL that
        powers your desktop deployment.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>API Base URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://api.cleanuptracker.com"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={apiBaseUrl}
          onChangeText={onChangeBaseUrl}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Employee Number (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="MGR001"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          value={employeeId}
          onChangeText={onChangeEmployeeId}
        />
      </View>

      <TouchableOpacity style={styles.outlineButton} onPress={onRecheck}>
        <Text style={styles.outlineButtonText}>Check Connectivity</Text>
      </TouchableOpacity>

      <View
        style={[
          styles.statusRow,
          styles.statusChip,
          connectionStatus === 'reachable' && styles.statusChipSuccess,
          connectionStatus === 'error' && styles.statusChipError
        ]}
      >
        <Ionicons
          name={
            connectionStatus === 'reachable'
              ? 'checkmark-circle-outline'
              : connectionStatus === 'error'
                ? 'alert-circle-outline'
                : connectionStatus === 'checking'
                  ? 'refresh-outline'
                  : 'radio-outline'
          }
          size={16}
          color={
            connectionStatus === 'reachable'
              ? COLORS.success
              : connectionStatus === 'error'
                ? COLORS.danger
                : COLORS.textSecondary
          }
        />
        <Text style={styles.statusChipText}>
          {getStatusText(connectionStatus, apiBaseUrl)}
        </Text>
      </View>
    </View>
  );
}

function AuthenticatedApp() {
  const { notice, setNotice, session } = useSession();

  const role = (session?.user?.role || '').toLowerCase();

  const screenConfigs = useMemo(() => {
    if (role === 'salesperson') {
      return [
        {
          name: 'Dashboard',
          component: SalesDashboardScreen,
          icon: 'car-outline',
          activeIcon: 'car'
        },
        {
          name: 'QC',
          component: QcScreen,
          icon: 'shield-checkmark-outline',
          activeIcon: 'shield-checkmark'
        },
        {
          name: 'Reports',
          component: ReportsScreen,
          icon: 'stats-chart-outline',
          activeIcon: 'stats-chart'
        },
        {
          name: 'Settings',
          component: SettingsScreen,
          icon: 'settings-outline',
          activeIcon: 'settings'
        }
      ];
    }

    const baseConfigs = [
      {
        name: 'Dashboard',
        component: DetailerDashboardScreen,
        icon: 'speedometer-outline',
        activeIcon: 'speedometer'
      },
      {
        name: 'New Job',
        component: DetailerNewJobScreen,
        icon: 'add-circle-outline',
        activeIcon: 'add-circle'
      },
      {
        name: 'Settings',
        component: SettingsScreen,
        icon: 'settings-outline',
        activeIcon: 'settings'
      }
    ];

    if (role === 'manager') {
      baseConfigs.splice(1, 0, {
        name: 'QC',
        component: QcScreen,
        icon: 'shield-checkmark-outline',
        activeIcon: 'shield-checkmark'
      });
      baseConfigs.splice(2, 0, {
        name: 'Reports',
        component: ReportsScreen,
        icon: 'stats-chart-outline',
        activeIcon: 'stats-chart'
      });
    }

    return baseConfigs;
  }, [role]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  return (
    <NavigationContainer theme={NAV_THEME}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: COLORS.panelSoft,
            borderTopColor: COLORS.border,
            height: 64
          },
          tabBarIcon: ({ color, focused }) => {
            const config = screenConfigs.find((item) => item.name === route.name);
            const defaultIcon = config?.icon || 'ellipse-outline';
            const activeIcon = config?.activeIcon || defaultIcon.replace('-outline', '');
            return (
              <View style={styles.tabIconWrapper}>
                <Ionicons
                  name={focused ? activeIcon : defaultIcon}
                  size={22}
                  color={focused ? COLORS.accent : color}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    focused && { color: COLORS.accent }
                  ]}
                >
                  {route.name}
                </Text>
              </View>
            );
          },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textSecondary
        })}
      >
        {screenConfigs.map((config) => (
          <Tab.Screen key={config.name} name={config.name} component={config.component} />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function DetailerDashboardScreen() {
  const {
    baseUrl,
    session,
    identifiers,
    dashboardRefreshSignal,
    triggerDashboardRefresh,
    notice,
    setNotice
  } = useSession();

  const token = session?.tokens?.accessToken;
  const [summary, setSummary] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [quickVin, setQuickVin] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickScannerVisible, setQuickScannerVisible] = useState(false);
  const [defaultServiceType, setDefaultServiceType] = useState('Cleanup');
  const isDetailer = ['detailer', 'technician'].includes(normalizeString(session?.user?.role));

  const loadData = useCallback(async () => {
    if (!baseUrl || !token) {
      return;
    }
    setRefreshing(true);
    try {
      // Use allSettled to handle partial failures gracefully
      const results = await Promise.allSettled([
        getDashboardSummary({ baseUrl, token }),
        fetchJobs({ baseUrl, token })
      ]);

      let hasError = false;
      const errors = [];

      // Process summary result
      if (results[0].status === 'fulfilled') {
        setSummary(results[0].value);
      } else {
        console.error('Summary load failed', results[0].reason);
        errors.push('summary');
        hasError = true;
      }

      // Process jobs result (independent of summary)
      if (results[1].status === 'fulfilled') {
        const jobsData = results[1].value;
        setJobs(Array.isArray(jobsData) ? jobsData : []);
      } else {
        console.error('Jobs load failed', results[1].reason);
        errors.push('jobs');
        hasError = true;
      }

      if (hasError) {
        setError(`Failed to load ${errors.join(' and ')}. Pull to refresh.`);
      } else {
        setError('');
      }
    } catch (err) {
      console.error('Dashboard load failed', err);
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl, token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(loadData, 60000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  useEffect(() => {
    if (dashboardRefreshSignal) {
      loadData();
    }
  }, [dashboardRefreshSignal, loadData]);

  useEffect(() => {
    if (!baseUrl || !token || !isDetailer) return;
    let mounted = true;
    (async () => {
      try {
        const settings = await fetchSettings({ baseUrl, token });
        if (!mounted) return;
        const catalog = Array.isArray(settings?.serviceTypes) ? settings.serviceTypes : [];
        const firstActive = catalog.find((type) => type.isActive !== false) || catalog[0];
        if (firstActive?.name) {
          setDefaultServiceType(firstActive.name);
        }
      } catch (err) {
        console.warn('Quick start settings load failed', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [baseUrl, token, isDetailer]);

  const assignedJobs = useMemo(() => {
    return jobs.filter((job) => {
      const assignedIds = (job.assignedTechnicianIds || []).map((id) => String(id));
      if (assignedIds.some((id) => identifiers.includes(id))) {
        return true;
      }
      if (job.technicianId && identifiers.includes(String(job.technicianId))) {
        return true;
      }
      if (job.technicianName && session?.user?.name) {
        return job.technicianName.trim().toLowerCase() === session.user.name.trim().toLowerCase();
      }
      return false;
    });
  }, [identifiers, jobs, session?.user?.name]);

  const activeJobs = useMemo(() => {
    return assignedJobs.filter((job) => !['Completed', 'QC Required'].includes(job.status));
  }, [assignedJobs]);

  const completedToday = useMemo(() => {
    const today = new Date();
    return assignedJobs.filter((job) => {
      if (job.status !== 'Completed') return false;
      const completedAt = job.completedAt ? new Date(job.completedAt) : null;
      if (!completedAt || Number.isNaN(completedAt.getTime())) {
        return false;
      }
      return completedAt.toDateString() === today.toDateString();
    });
  }, [assignedJobs]);

  const handleCompleteJob = async (jobId) => {
    try {
      await completeJob({ baseUrl, token, jobId });
      setNotice({ type: 'success', text: 'Job completed successfully.' });
      triggerDashboardRefresh();
    } catch (err) {
      setNotice({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to complete job.'
      });
    }
  };

  const handlePauseJob = async (jobId, status) => {
    try {
      if (status === 'Paused') {
        await resumeJob({ baseUrl, token, jobId });
        setNotice({ type: 'info', text: 'Job resumed.' });
      } else {
        await pauseJob({ baseUrl, token, jobId, reason: 'Paused from mobile app' });
        setNotice({ type: 'info', text: 'Job paused.' });
      }
      triggerDashboardRefresh();
    } catch (err) {
      setNotice({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to update job.'
      });
    }
  };

  const metrics = [
    {
      label: 'Open Jobs',
      icon: 'briefcase-outline',
      tint: COLORS.accent,
      value: computeMetricValue(summary?.openJobs)
    },
    {
      label: 'Completed Today',
      icon: 'checkmark-done-outline',
      tint: COLORS.success,
      value: computeMetricValue(summary?.completedToday)
    },
    {
      label: 'Avg. Duration',
      icon: 'timer-outline',
      tint: COLORS.warning,
      value: summary?.averageDuration ? `${summary.averageDuration} mins` : '—'
    }
  ];

  const handleQuickStart = useCallback(async (vinValue) => {
    const normalized = vinValue.trim().toUpperCase();
    if (!normalized) {
      setNotice({ type: 'error', text: 'Scan or enter a VIN to start a job.' });
      return;
    }
    if (!baseUrl || !token) {
      setNotice({ type: 'error', text: 'API base URL or session missing.' });
      return;
    }
    setQuickLoading(true);
    try {
      let description = 'Mobile job';
      let vinToUse = normalized;
      try {
        const matches = await searchVehicles({ baseUrl, token, query: normalized });
        if (Array.isArray(matches) && matches.length > 0) {
          const vehicle = matches[0];
          description = vehicle.vehicleDescription || `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || description;
          if (vehicle.vin) {
            vinToUse = vehicle.vin.toUpperCase();
          }
        } else if (normalized.length !== 17) {
          setNotice({ type: 'error', text: 'Enter a full VIN or search for a stock number with inventory data.' });
          setQuickLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Quick start inventory lookup failed', err.message);
        if (normalized.length !== 17) {
          setNotice({ type: 'error', text: 'Inventory lookup failed; enter a full VIN or try again.' });
          setQuickLoading(false);
          return;
        }
      }

      await createJob({
        baseUrl,
        token,
        payload: {
          technicianId: session?.user?.id || session?.user?.employeeNumber || session?.user?.pin,
          technicianName: session?.user?.name || 'Detailer',
          vin: vinToUse,
          vehicleDescription: description,
          serviceType: defaultServiceType || 'Cleanup',
          priority: 'Normal'
        }
      });

      setQuickVin('');
      setNotice({ type: 'success', text: `Job started for ${vinToUse}.` });
      triggerDashboardRefresh();
    } catch (err) {
      console.error('Quick start job failed', err);
      setNotice({ type: 'error', text: err.response?.data?.error || err.message || 'Unable to start job.' });
    } finally {
      setQuickLoading(false);
    }
  }, [baseUrl, token, session?.user, defaultServiceType, setNotice, triggerDashboardRefresh]);

  const handleQuickScanDetected = useCallback((capturedVin) => {
    setQuickScannerVisible(false);
    if (capturedVin) {
      setQuickVin(capturedVin.trim().toUpperCase());
      handleQuickStart(capturedVin);
    }
  }, [handleQuickStart]);

  return (
    <ScrollView
      style={styles.screenWrapper}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          tintColor={COLORS.accent}
          refreshing={refreshing}
          onRefresh={loadData}
        />
      }
    >
      <NoticeBanner notice={notice} />
      <Text style={styles.screenTitle}>Detailer Dashboard</Text>
      <Text style={styles.screenSubtitle}>
        Track your active jobs, progress milestones, and performance insights.
      </Text>

      {isDetailer && (
        <View style={styles.quickStartCard}>
          <Text style={styles.chartTitle}>Quick Start Job</Text>
          <Text style={styles.quickStartSubtitle}>Scan or enter a VIN to create a job immediately.</Text>
          <TextInput
            style={styles.input}
            value={quickVin}
            onChangeText={(value) => setQuickVin(value.toUpperCase())}
            placeholder="Scan or enter VIN"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, quickLoading && styles.buttonDisabled]}
              onPress={() => handleQuickStart(quickVin)}
              disabled={quickLoading}
            >
              {quickLoading ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Ionicons name="flash-outline" size={18} color={COLORS.accent} />
              )}
              <Text style={styles.actionButtonText}>Start Job</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setQuickScannerVisible(true)}
            >
              <Ionicons name="scan-outline" size={18} color={COLORS.accent} />
              <Text style={styles.actionButtonText}>Scan VIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.metricsRow}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: `${metric.tint}1a` }]}>
              <Ionicons name={metric.icon} size={18} color={metric.tint} />
            </View>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <VinScannerModal
        visible={quickScannerVisible}
        onClose={() => setQuickScannerVisible(false)}
        onDetected={handleQuickScanDetected}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeading}>Active Jobs</Text>
        <Text style={styles.sectionMeta}>{activeJobs.length} in progress</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingPane}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading your jobs…</Text>
        </View>
      ) : (
        <>
          {activeJobs.map((job) => (
            <View key={job.id} style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <View>
                  <Text style={styles.jobTitle}>{job.vehicleDescription || 'Job'}</Text>
                  <Text style={styles.jobMeta}>{job.vin || 'VIN TBD'}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: `${(STATUS_COLORS[job.status] || STATUS_COLORS.default)}22` },
                    { borderColor: STATUS_COLORS[job.status] || STATUS_COLORS.default }
                  ]}
                >
                  <Ionicons
                    name="ellipse"
                    size={8}
                    color={STATUS_COLORS[job.status] || STATUS_COLORS.default}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: STATUS_COLORS[job.status] || STATUS_COLORS.default }
                    ]}
                  >
                    {job.status}
                  </Text>
                </View>
              </View>

              <View style={styles.jobDetailsRow}>
                <DetailItem icon="flash-outline" label="Service" value={job.serviceType || 'Cleanup'} />
                <DetailItem icon="person-outline" label="Assigned" value={job.technicianName || '—'} />
                <DetailItem icon="time-outline" label="Started" value={formatElapsedMinutes(job.startTime)} />
              </View>

              <View style={styles.jobActions}>
                <TouchableOpacity
                  style={[styles.jobActionButton, styles.jobActionPrimary]}
                  onPress={() => handleCompleteJob(job.id)}
                >
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.background} />
                  <Text style={styles.jobActionPrimaryLabel}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.jobActionButton}
                  onPress={() => handlePauseJob(job.id, job.status)}
                >
                  <Ionicons
                    name={job.status === 'Paused' ? 'play-circle-outline' : 'pause-circle-outline'}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.jobActionLabel}>
                    {job.status === 'Paused' ? 'Resume' : 'Pause'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {activeJobs.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={22} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateTitle}>No active jobs</Text>
              <Text style={styles.emptyStateText}>
                You’re all caught up. Create a new job or refresh to sync assignments.
              </Text>
            </View>
          )}
        </>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeading}>Completed Today</Text>
        <Text style={styles.sectionMeta}>{completedToday.length} jobs</Text>
      </View>
      {completedToday.map((job) => (
        <View key={job.id} style={styles.completedCard}>
          <View>
            <Text style={styles.jobTitle}>{job.vehicleDescription || 'Job'}</Text>
            <Text style={styles.jobMeta}>
              Completed at {job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : '—'}
            </Text>
          </View>
          <Text style={[styles.jobMeta, { color: COLORS.textSecondary }]}>
            {job.serviceType || 'Cleanup'}
          </Text>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function NoticeBanner({ notice }) {
  if (!notice) return null;
  const isSuccess = notice.type === 'success';
  const isError = notice.type === 'error';
  const icon = isSuccess ? 'checkmark-circle' : isError ? 'alert-circle' : 'information-circle';

  return (
    <View
      style={[
        styles.noticeBanner,
        isSuccess && styles.noticeBannerSuccess,
        isError && styles.noticeBannerError,
        !isSuccess && !isError && styles.noticeBannerInfo
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isError ? COLORS.danger : isSuccess ? COLORS.textPrimary : COLORS.accent}
      />
      <Text
        style={[
          styles.noticeText,
          isError && { color: COLORS.danger },
          !isSuccess && !isError && { color: COLORS.accent }
        ]}
      >
        {notice.text}
      </Text>
    </View>
  );
}

function QcScreen() {
  const {
    baseUrl,
    session,
    triggerDashboardRefresh,
    notice,
    setNotice
  } = useSession();

  const role = normalizeString(session?.user?.role);
  const canApprove = role === 'manager';

  const token = session?.tokens?.accessToken;
  const [qcJobs, setQcJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notesById, setNotesById] = useState({});

  const loadQcJobs = useCallback(async () => {
    if (!baseUrl || !token) {
      return;
    }
    setRefreshing(true);
    try {
      const jobsResponse = await fetchJobs({ baseUrl, token });
      const filtered = Array.isArray(jobsResponse)
        ? jobsResponse.filter((job) => job.status === 'QC Required')
        : [];
      setQcJobs(filtered);
      setError('');
    } catch (err) {
      console.error('QC load failed', err);
      setError(err.response?.data?.error || err.message || 'Failed to load QC queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl, token]);

  useFocusEffect(
    useCallback(() => {
      loadQcJobs();
      const interval = setInterval(loadQcJobs, 45000);
      return () => clearInterval(interval);
    }, [loadQcJobs])
  );

  const handleQcAction = async (jobId, passed) => {
    if (!canApprove) {
      setNotice({ type: 'info', text: 'Only managers can complete QC actions on mobile.' });
      return;
    }
    try {
      const notes = (notesById[jobId] || '').trim();
      await completeQc({
        baseUrl,
        token,
        jobId,
        qcPassed: passed,
        qcNotes: notes,
        qcCheckerId: session?.user?.id || session?.user?.employeeNumber
      });
      setNotice({
        type: passed ? 'success' : 'info',
        text: passed ? 'Job approved and ready for delivery.' : 'Job flagged for rework.'
      });
      setNotesById((prev) => ({ ...prev, [jobId]: '' }));
      triggerDashboardRefresh();
      loadQcJobs();
    } catch (err) {
      console.error('QC action failed', err);
      setNotice({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Unable to complete QC action.'
      });
    }
  };

  return (
    <ScrollView
      style={styles.screenWrapper}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          tintColor={COLORS.accent}
          refreshing={refreshing}
          onRefresh={loadQcJobs}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      <NoticeBanner notice={notice} />
      <Text style={styles.screenTitle}>Quality Control</Text>
      <Text style={styles.screenSubtitle}>
        Review completed work, add notes, and approve or return jobs for rework.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingPane}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading QC queue…</Text>
        </View>
      ) : (
        <>
          {qcJobs.map((job) => (
            <View key={job.id} style={styles.qcCard}>
              <View style={styles.jobHeader}>
                <View>
                  <Text style={styles.jobTitle}>{job.vehicleDescription || 'Vehicle'}</Text>
                  <Text style={styles.jobMeta}>{job.vin || 'VIN TBD'}</Text>
                </View>
                <View style={[styles.statusPill, styles.qcStatusPill]}>
                  <Ionicons name="alert" size={14} color={COLORS.warning} />
                  <Text style={[styles.statusPillText, { color: COLORS.warning }]}>QC Required</Text>
                </View>
              </View>

              <View style={styles.jobDetailsRow}>
                <DetailItem icon="person-outline" label="Technician" value={job.technicianName || '—'} />
                <DetailItem icon="flash-outline" label="Service" value={job.serviceType || 'Cleanup'} />
                <DetailItem icon="time-outline" label="Completed" value={job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : '—'} />
              </View>

              <Text style={styles.label}>QC Notes</Text>
              <TextInput
                style={styles.qcNotesInput}
                multiline
                placeholder="Add notes for approval or rework instructions"
                placeholderTextColor={COLORS.textSecondary}
                value={notesById[job.id] || ''}
                onChangeText={(value) => setNotesById((prev) => ({ ...prev, [job.id]: value }))}
              />

              <View style={styles.jobActions}>
                <TouchableOpacity
                  style={[styles.jobActionButton, styles.jobActionApprove]}
                  onPress={() => handleQcAction(job.id, true)}
                  disabled={!canApprove}
                >
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.background} />
                  <Text style={styles.jobActionPrimaryLabel}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.jobActionButton, styles.jobActionFlag]}
                  onPress={() => handleQcAction(job.id, false)}
                  disabled={!canApprove}
                >
                  <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                  <Text style={[styles.jobActionLabel, { color: COLORS.danger }]}>Needs Work</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {qcJobs.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateTitle}>QC queue is clear</Text>
              <Text style={styles.emptyStateText}>
                No jobs are waiting for quality control. Pull to refresh when new work is completed.
              </Text>
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function SalesDashboardScreen() {
  const {
    baseUrl,
    session,
    notice,
    setNotice
  } = useSession();

  const token = session?.tokens?.accessToken;
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [timerTick, setTimerTick] = useState(Date.now());
  const [filterTerm, setFilterTerm] = useState('');

  const loadJobs = useCallback(async () => {
    if (!baseUrl || !token) return;
    setRefreshing(true);
    try {
      const data = await fetchJobs({ baseUrl, token });
      setJobs(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Sales dashboard jobs failed', err);
      setError(err.response?.data?.error || err.message || 'Unable to load job data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl, token]);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
      const interval = setInterval(loadJobs, 60000);
      return () => clearInterval(interval);
    }, [loadJobs])
  );

  useEffect(() => {
    const interval = setInterval(() => setTimerTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const awaitingQc = useMemo(() =>
    jobs.filter((job) => jobMatchesSalesperson(job, session?.user) && job.status === 'QC Required'),
  [jobs, session?.user]);

  const inProgress = useMemo(() =>
    jobs.filter((job) => jobMatchesSalesperson(job, session?.user) && job.status === 'In Progress'),
  [jobs, session?.user]);

  const completedToday = useMemo(() => {
    const today = new Date();
    return jobs.filter((job) => jobMatchesSalesperson(job, session?.user) && job.status === 'Completed' && jobCompletedOn(job, today));
  }, [jobs, session?.user]);

  const currentJob = useMemo(() => {
    if (inProgress.length === 0) return null;
    return [...inProgress].sort((a, b) => new Date(a.startTime || a.createdAt || 0) - new Date(b.startTime || b.createdAt || 0))[0];
  }, [inProgress]);

  const elapsedText = useMemo(
    () => (currentJob ? formatElapsedMinutes(currentJob.startTime) : '—'),
    [currentJob, timerTick]
  );

  const deliveriesToday = completedToday.filter((job) =>
    String(job.serviceType || '').toLowerCase().includes('delivery')
  );

  const summaryCards = [
    {
      label: 'Vehicles In Progress',
      value: inProgress.length
    },
    {
      label: 'Awaiting QC',
      value: awaitingQc.length
    },
    {
      label: 'Completed Today',
      value: completedToday.length
    },
    {
      label: 'Deliveries Today',
      value: deliveriesToday.length
    }
  ];

  return (
    <ScrollView
      style={styles.screenWrapper}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          tintColor={COLORS.accent}
          refreshing={refreshing}
          onRefresh={loadJobs}
        />
      }
    >
      <NoticeBanner notice={notice} />
      <Text style={styles.screenTitle}>Sales Activity</Text>
      <Text style={styles.screenSubtitle}>
        Track vehicles under your watch, monitor stages, and keep customers informed in real time.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.analyticsCardsRow}>
        {summaryCards.map((card) => (
          <View key={card.label} style={styles.analyticsCard}>
            <Text style={styles.analyticsCardValue}>{card.value}</Text>
            <Text style={styles.analyticsCardLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.salesCard}>
        <Text style={styles.chartTitle}>Current Vehicle In Detail</Text>
        {loading && !currentJob ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        ) : currentJob ? (
          <>
            <View style={styles.salesVehicleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.salesVehicleTitle}>{currentJob.vehicleDescription || 'Vehicle'}</Text>
                <Text style={styles.salesVehicleMeta}>VIN {currentJob.vin || 'TBD'}</Text>
                {currentJob.stockNumber ? (
                  <Text style={styles.salesVehicleMeta}>Stock #{currentJob.stockNumber}</Text>
                ) : null}
              </View>
              <View style={styles.statusPill}>
                <Ionicons name="timer-outline" size={16} color={COLORS.accent} />
                <Text style={[styles.statusPillText, { color: COLORS.accent }]}>{currentJob.status}</Text>
              </View>
            </View>
            <View style={styles.salesMetaRow}>
              <View style={styles.salesMetaItem}>
                <Text style={styles.salesMetaLabel}>Detailer</Text>
                <Text style={styles.salesMetaValue}>{currentJob.technicianName || '—'}</Text>
              </View>
              <View style={styles.salesMetaItem}>
                <Text style={styles.salesMetaLabel}>Stage</Text>
                <Text style={styles.salesMetaValue}>{currentJob.qcRequired ? 'Awaiting QC' : currentJob.status}</Text>
              </View>
              <View style={styles.salesMetaItem}>
                <Text style={styles.salesMetaLabel}>Elapsed</Text>
                <Text style={styles.salesMetaValue}>{elapsedText}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.chartEmpty}>No vehicles are currently in detail for you.</Text>
        )}
      </View>

      <View style={styles.salesListCard}>
        <Text style={styles.chartTitle}>Today&apos;s Vehicles</Text>
        <TextInput
          style={styles.input}
          placeholder="Search VIN or Stock #"
          placeholderTextColor={COLORS.textSecondary}
          value={filterTerm}
          autoCapitalize="characters"
          onChangeText={(value) => setFilterTerm(value.toUpperCase())}
        />
        {completedToday.length === 0 && awaitingQc.length === 0 && inProgress.length === 0 ? (
          <Text style={styles.chartEmpty}>No vehicles assigned today. Pull to refresh when work starts.</Text>
        ) : (
          <>
            {[...inProgress, ...awaitingQc, ...completedToday]
              .filter((job) => {
                if (!filterTerm.trim()) return true;
                const term = normalizeString(filterTerm);
                return normalizeString(job.vin).includes(term) || normalizeString(job.stockNumber).includes(term);
              })
              .map((job) => {
              const statusStyles = getSalesStatusStyles(job.status);
              return (
                <View key={job.id} style={styles.salesRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.salesRowTitle}>{job.vehicleDescription || job.vin}</Text>
                    <Text style={styles.salesRowMeta}>VIN {job.vin || 'TBD'} · {job.serviceType || 'Service'}</Text>
                  </View>
                  <View
                    style={[
                      styles.salesStatusBadge,
                      { backgroundColor: statusStyles.backgroundColor, borderColor: statusStyles.borderColor }
                    ]}
                  >
                    <Text style={[styles.salesStatusText, { color: statusStyles.color }]}>{job.status}</Text>
                  </View>
                </View>
              );
              })}
          </>
        )}
      </View>

      <View style={styles.salesListCard}>
        <Text style={styles.chartTitle}>Completed Today</Text>
        {completedToday.length === 0 ? (
          <Text style={styles.chartEmpty}>No vehicles completed today. Completed work will appear here.</Text>
        ) : (
          completedToday.map((job) => (
            <View key={job.id} style={styles.salesTableRow}>
              <Text style={styles.salesTableCell}>{(job.completedAt || job.createdAt || '').slice(5, 10)}</Text>
              <Text style={styles.salesTableCell}>{job.stockNumber || '—'}</Text>
              <Text style={styles.salesTableCell}>{job.vin || '—'}</Text>
              <Text style={styles.salesTableCell}>{job.technicianName || '—'}</Text>
              <Text style={styles.salesTableCell}>{job.serviceType || '—'}</Text>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ReportsScreen() {
  const {
    baseUrl,
    session,
    notice,
    setNotice
  } = useSession();

  const token = session?.tokens?.accessToken;
  const [range, setRange] = useState('7');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState([]);

  const loadJobs = useCallback(async () => {
    if (!baseUrl || !token) return;
    try {
      const data = await fetchJobs({ baseUrl, token });
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Reports jobs load failed', err);
      setNotice({ type: 'error', text: err.response?.data?.error || err.message || 'Unable to load jobs for analytics.' });
    }
  }, [baseUrl, token, setNotice]);

  const fetchReport = useCallback(async () => {
    if (!baseUrl || !token) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (range === '30' ? 29 : 6));
      const params = {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
      const data = await fetchReports({ baseUrl, token, params });
      setReport(data);
    } catch (err) {
      console.error('Reports fetch failed', err);
      setError(err.response?.data?.error || err.message || 'Unable to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl, token, range]);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
      fetchReport();
    }, [fetchReport, loadJobs])
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs, range]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    await fetchReport();
  }, [loadJobs, fetchReport]);

  const chartWidth = Math.min(Dimensions.get('window').width - 48, 520);

  const { periodStart, periodEnd } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    const days = Number(range);
    start.setDate(end.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return { periodStart: start, periodEnd: end };
  }, [range, report, jobs]);

  const periodJobs = useMemo(() => (
    jobs.filter((job) => jobWithinRange(job, periodStart, periodEnd))
  ), [jobs, periodStart, periodEnd]);

  const completedPeriodJobs = useMemo(() => (
    periodJobs.filter((job) => ['completed', 'qc approved'].includes(normalizeString(job.status)))
  ), [periodJobs]);

  const deliveryPeriodJobs = useMemo(() => (
    completedPeriodJobs.filter((job) => normalizeString(job.serviceType).includes('delivery'))
  ), [completedPeriodJobs]);

  const awaitingQcCount = useMemo(() => (
    jobs.filter((job) => job.status === 'QC Required').length
  ), [jobs]);

  const inProgressCount = useMemo(() => (
    jobs.filter((job) => job.status === 'In Progress').length
  ), [jobs]);

  const averageDuration = useMemo(() => {
    if (completedPeriodJobs.length === 0) return '—';
    const total = completedPeriodJobs.reduce((sum, job) => sum + (job.duration || 0), 0);
    return `${Math.round(total / completedPeriodJobs.length)} mins`;
  }, [completedPeriodJobs]);

  const summaryCards = useMemo(() => {
    return [
      { label: 'Vehicles Completed', value: completedPeriodJobs.length },
      { label: 'Deliveries', value: deliveryPeriodJobs.length },
      { label: 'Avg Turn Time', value: averageDuration },
      { label: 'Awaiting QC', value: awaitingQcCount }
    ];
  }, [completedPeriodJobs.length, deliveryPeriodJobs.length, averageDuration, awaitingQcCount]);

  const trendData = useMemo(() => {
    if (!report?.dailyTrends) return [];
    const days = Number(range);
    return report.dailyTrends.slice(-days).map((day) => ({
      x: day.date.slice(5),
      y: day.completed || 0,
      total: day.jobs || 0
    }));
  }, [report, range]);

  const serviceData = useMemo(() => {
    if (!report?.serviceTypes) return [];
    return report.serviceTypes
      .map((service) => ({ x: service.name, y: service.jobs || 0 }))
      .slice(0, 6);
  }, [report]);

  const detailers = useMemo(() => {
    if (!report?.detailerPerformance) return [];
    return [...report.detailerPerformance]
      .sort((a, b) => (b.totalJobs || 0) - (a.totalJobs || 0))
      .slice(0, 6);
  }, [report]);

  return (
    <ScrollView
      style={styles.screenWrapper}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          tintColor={COLORS.accent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      <NoticeBanner notice={notice} />
      <Text style={styles.screenTitle}>Manager Analytics</Text>
      <Text style={styles.screenSubtitle}>
        Monitor service throughput, quality trends, and team performance across your operation.
      </Text>

      <View style={styles.rangeRow}>
        {['7', '30'].map((value) => {
          const active = range === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.rangeButton, active && styles.rangeButtonActive]}
              onPress={() => setRange(value)}
            >
              <Text style={[styles.rangeButtonText, active && styles.rangeButtonTextActive]}>
                Last {value} Days
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.analyticsCardsRow}>
        {summaryCards.map((card) => (
          <View key={card.label} style={styles.analyticsCard}>
            <Text style={styles.analyticsCardValue}>{card.value}</Text>
            <Text style={styles.analyticsCardLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Completion Trend</Text>
        {loading && trendData.length === 0 ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        ) : trendData.length > 0 ? (
          <VictoryChart
            width={chartWidth}
            height={220}
            padding={{ top: 40, bottom: 50, left: 50, right: 20 }}
            theme={VictoryTheme.material}
            domainPadding={{ x: 12, y: 20 }}
          >
            <VictoryAxis
              style={{
                axis: { stroke: 'transparent' },
                tickLabels: { fill: COLORS.textSecondary, fontSize: 11 }
              }}
            />
            <VictoryAxis
              dependentAxis
              style={{
                axis: { stroke: 'transparent' },
                grid: { stroke: '#1f242c' },
                tickLabels: { fill: COLORS.textSecondary, fontSize: 11 }
              }}
            />
            <VictoryLine
              data={trendData}
              style={{ data: { stroke: COLORS.accent, strokeWidth: 3 } }}
              interpolation="monotoneX"
            />
          </VictoryChart>
        ) : (
          <Text style={styles.chartEmpty}>Not enough data to visualise this range.</Text>
        )}
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Service Type Volume</Text>
        {serviceData.length > 0 ? (
          <VictoryChart
            width={chartWidth}
            height={220}
            domainPadding={{ x: 30, y: 20 }}
            padding={{ top: 40, bottom: 70, left: 50, right: 20 }}
            theme={VictoryTheme.material}
          >
            <VictoryAxis
              style={{
                axis: { stroke: 'transparent' },
                tickLabels: { fill: COLORS.textSecondary, fontSize: 11, angle: -30, padding: 18 }
              }}
            />
            <VictoryAxis
              dependentAxis
              style={{
                axis: { stroke: 'transparent' },
                grid: { stroke: '#1f242c' },
                tickLabels: { fill: COLORS.textSecondary, fontSize: 11 }
              }}
            />
            <VictoryBar
              data={serviceData}
              style={{ data: { fill: COLORS.success, width: 22 } }}
            />
          </VictoryChart>
        ) : (
          <Text style={styles.chartEmpty}>Service type analytics will appear once jobs are completed.</Text>
        )}
      </View>

      <View style={styles.detailerList}>
        <Text style={styles.chartTitle}>Top Detailers</Text>
        {loading && detailers.length === 0 ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        ) : detailers.length > 0 ? (
          detailers.map((detailer) => (
            <View key={detailer.name} style={styles.detailerRow}>
              <View>
                <Text style={styles.detailerName}>{detailer.name}</Text>
                <Text style={styles.detailerMeta}>{detailer.totalJobs} jobs · Avg {detailer.avgTime || 0} mins</Text>
              </View>
              <View style={styles.detailerMetricBadge}>
                <Text style={styles.detailerMetricText}>{detailer.recentJobs || 0} last 7d</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.chartEmpty}>Detailer performance data will appear once jobs are completed.</Text>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function DetailerNewJobScreen() {
  const {
    baseUrl,
    session,
    triggerDashboardRefresh,
    notice,
    setNotice
  } = useSession();

  const token = session?.tokens?.accessToken;
  const [serviceTypes, setServiceTypes] = useState([]);
  const [selectedServiceType, setSelectedServiceType] = useState('');
  const [vin, setVin] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const loadServiceTypes = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const data = await fetchSettings({ baseUrl, token });
      const catalog = Array.isArray(data?.serviceTypes) ? data.serviceTypes : [];
      setServiceTypes(catalog);
      if (!selectedServiceType && catalog.length > 0) {
        const firstActive = catalog.find((type) => type.isActive !== false) || catalog[0];
        setSelectedServiceType(firstActive?.name || '');
      }
      setInitialized(true);
    } catch (err) {
      console.error('Failed to load service types', err);
      setError(err.response?.data?.error || err.message || 'Unable to load service catalog.');
    }
  }, [baseUrl, selectedServiceType, token]);

  useFocusEffect(
    useCallback(() => {
      loadServiceTypes();
    }, [loadServiceTypes])
  );

  const prefillFromVin = useCallback(async (vinInput, { showNotice = true } = {}) => {
    if (!baseUrl || !token || !vinInput) return;
    try {
      const matches = await searchVehicles({ baseUrl, token, query: vinInput });
      if (Array.isArray(matches) && matches.length > 0) {
        const vehicle = matches[0];
        const description = vehicle.vehicleDescription || `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim();
        if (description) {
          setVehicleDescription(description);
        }
        if (showNotice) {
          setNotice({ type: 'info', text: `Inventory match loaded for ${vehicle.vin}.` });
        }
      } else if (showNotice) {
        setNotice({ type: 'info', text: 'No inventory match found for that VIN.' });
      }
    } catch (err) {
      console.error('VIN prefill failed', err);
      if (showNotice) {
        setNotice({
          type: 'error',
          text: err.response?.data?.error || err.message || 'Unable to query inventory.'
        });
      }
    }
  }, [baseUrl, token, setNotice]);

  const handleLookupVehicle = useCallback(async () => {
    const normalized = vin.trim().toUpperCase();
    if (normalized.length < 6) {
      setError('Enter at least 6 characters to look up inventory.');
      return;
    }
    setLookupLoading(true);
    setError('');
    await prefillFromVin(normalized);
    setLookupLoading(false);
  }, [vin, prefillFromVin]);

  const handleVinCaptured = useCallback((capturedVin) => {
    setScannerVisible(false);
    const normalized = capturedVin.trim().toUpperCase();
    if (!normalized) {
      setNotice({ type: 'error', text: 'Scanner did not return a valid VIN.' });
      return;
    }
    setVin(normalized);
    setNotice({ type: 'info', text: `VIN ${normalized} captured.` });
    prefillFromVin(normalized, { showNotice: false });
  }, [prefillFromVin, setNotice]);

  const handleCreateJob = async () => {
    if (!vin.trim()) {
      setError('Enter the VIN before creating a job.');
      return;
    }
    if (!selectedServiceType) {
      setError('Select a service type.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createJob({
        baseUrl,
        token,
        payload: {
          technicianId: session?.user?.id || session?.user?.employeeNumber || session?.user?.pin,
          technicianName: session?.user?.name || 'Mobile Detailer',
          vin: vin.trim().toUpperCase(),
          vehicleDescription: vehicleDescription.trim() || 'Mobile created job',
          serviceType: selectedServiceType,
          priority
        }
      });

      setVin('');
      setVehicleDescription('');
      setNotice({
        type: 'success',
        text: 'New job created successfully.'
      });
      triggerDashboardRefresh();
    } catch (err) {
      console.error('Create job failed', err);
      setError(err.response?.data?.error || err.message || 'Failed to create job.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screenWrapper}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      <NoticeBanner notice={notice} />
      <Text style={styles.screenTitle}>Create New Job</Text>
      <Text style={styles.screenSubtitle}>
        Scan or enter the VIN, select the service, and dispatch the work order instantly.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>VIN</Text>
        <TextInput
          style={styles.input}
          value={vin}
          onChangeText={(value) => setVin(value.toUpperCase())}
          placeholder="1FTFW1E88JFB12345"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setScannerVisible(true)}
          >
            <Ionicons name="scan-outline" size={18} color={COLORS.accent} />
            <Text style={styles.actionButtonText}>Scan VIN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, lookupLoading && styles.buttonDisabled]}
            onPress={handleLookupVehicle}
            disabled={lookupLoading}
          >
            {lookupLoading ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Ionicons name="search-outline" size={18} color={COLORS.accent} />
            )}
            <Text style={styles.actionButtonText}>Lookup Vehicle</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Vehicle Description</Text>
        <TextInput
          style={styles.input}
          value={vehicleDescription}
          onChangeText={setVehicleDescription}
          placeholder="F-150 Crew Cab"
          placeholderTextColor={COLORS.textSecondary}
        />

        <Text style={styles.label}>Service Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceTypeRow}
        >
          {serviceTypes.map((type) => {
            const isSelected = selectedServiceType === type.name;
            return (
              <TouchableOpacity
                key={type.name}
                style={[
                  styles.serviceTypeChip,
                  isSelected && styles.serviceTypeChipSelected
                ]}
                onPress={() => setSelectedServiceType(type.name)}
              >
                <Text
                  style={[
                    styles.serviceTypeText,
                    isSelected && styles.serviceTypeTextSelected
                  ]}
                >
                  {type.name}
                </Text>
              </TouchableOpacity>
            );
          })}
          {!initialized && (
            <View style={styles.loadingPaneInline}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.loadingText}>Loading types…</Text>
            </View>
          )}
        </ScrollView>

        <Text style={styles.label}>Priority</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceTypeRow}
        >
          {['Normal', 'High', 'Urgent'].map((level) => {
            const isSelected = priority === level;
            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.serviceTypeChip,
                  isSelected && styles.serviceTypeChipSelected
                ]}
                onPress={() => setPriority(level)}
              >
                <Text
                  style={[
                    styles.serviceTypeText,
                    isSelected && styles.serviceTypeTextSelected
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleCreateJob}
          disabled={loading}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentAlt]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Submitting…' : 'Create Job'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Use the VIN scanner</Text>
          <Text style={styles.infoText}>
            Align the barcode within the blue frame to capture the VIN automatically. QR badges are
            supported in the top-right capture zone.
          </Text>
        </View>
      </View>

      <VinScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onDetected={handleVinCaptured}
      />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function VinScannerModal({ visible, onClose, onDetected }) {
  const [permission, requestPermission] = useCameraPermissions();
  const detectionLocked = useRef(false);
  const scanAnimation = useRef(new Animated.Value(0));
  const { width: windowWidth } = Dimensions.get('window');
  const vinFrameWidth = useMemo(() => Math.min(windowWidth * 0.9, 360), [windowWidth]);
  const vinFrameHeight = useMemo(() => Math.max(120, vinFrameWidth * 0.24), [vinFrameWidth]);
  const qrSize = useMemo(() => Math.min(windowWidth * 0.3, 120), [windowWidth]);

  useEffect(() => {
    detectionLocked.current = false;
    if (visible && permission && !permission.granted) {
      requestPermission().catch(() => {
        // handled by permission state
      });
    }
  }, [visible, permission, requestPermission]);

  const hasPermission = permission?.granted;

  useEffect(() => {
    let animation;
    if (visible && hasPermission) {
      detectionLocked.current = false;
      scanAnimation.current.setValue(0);
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnimation.current, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.delay(220),
          Animated.timing(scanAnimation.current, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true
          })
        ])
      );
      animation.start();
    }
    return () => {
      animation?.stop();
    };
  }, [visible, hasPermission]);

  const handleBarCodeScanned = useCallback(
    ({ data }) => {
      if (!visible || !data || detectionLocked.current) {
        return;
      }
      detectionLocked.current = true;
      onDetected(data);
    },
    [visible, onDetected]
  );

  if (!visible) {
    return null;
  }

  const scanLineTranslateY = scanAnimation.current.interpolate({
    inputRange: [0, 1],
    outputRange: [18, vinFrameHeight - 18]
  });

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={styles.scannerRoot}>
        {hasPermission ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['code128', 'code39', 'code93', 'codabar', 'ean13', 'ean8', 'qr', 'upc_a', 'upc_e']
              }}
            />
            <View style={styles.scannerDim} pointerEvents="none" />
            <View style={styles.scannerOverlay} pointerEvents="none">
              <Text style={styles.scannerHintHeading}>VIN BARCODE</Text>
              <Text style={styles.scannerHintSubheading}>Align the barcode along the blue rails</Text>
              <View style={[styles.vinFrame, { width: vinFrameWidth, height: vinFrameHeight }]}>
                <View style={[styles.vinCorner, styles.vinCornerTL]} />
                <View style={[styles.vinCorner, styles.vinCornerTR]} />
                <View style={[styles.vinCorner, styles.vinCornerBL]} />
                <View style={[styles.vinCorner, styles.vinCornerBR]} />
                <View style={[styles.vinGuideLine, { top: 16, width: vinFrameWidth - 40 }]} />
                <View style={[styles.vinGuideLine, { bottom: 16, width: vinFrameWidth - 40 }]} />
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      width: vinFrameWidth - 40,
                      transform: [{ translateY: scanLineTranslateY }]
                    }
                  ]}
                />
              </View>
              <View style={styles.scannerQrSection}>
                <View style={[styles.scannerQrContainer, { width: qrSize, height: qrSize }]}>
                  <View style={[styles.qrCorner, styles.qrCornerTL]} />
                  <View style={[styles.qrCorner, styles.qrCornerTR]} />
                  <View style={[styles.qrCorner, styles.qrCornerBL]} />
                  <View style={[styles.qrCorner, styles.qrCornerBR]} />
                </View>
                <Text style={styles.scannerHintSubheading}>QR BADGE</Text>
              </View>
              <View style={styles.scannerInstructionsBottom}>
                <Text style={styles.scannerInstructionText}>VIN: align barcode within blue gate</Text>
                <Text style={styles.scannerInstructionText}>QR: position badge in green square</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.scannerCloseButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.background} />
              <Text style={styles.scannerCloseText}>Close</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.scannerPermissionContainer}>
            <Ionicons name="camera-outline" size={42} color={COLORS.textSecondary} />
            <Text style={styles.scannerPermissionText}>
              Camera permission is required to scan VIN barcodes.
            </Text>
            <TouchableOpacity style={styles.scannerPermissionButton} onPress={requestPermission}>
              <Text style={styles.scannerPermissionButtonText}>Grant Camera Access</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.scannerPermissionDismiss}>
              <Text style={styles.scannerPermissionDismissText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

function SettingsScreen() {
  const {
    rawBaseUrl,
    updateBaseUrl,
    connectionStatus,
    checkConnectivity,
    session,
    signOut
  } = useSession();

  return (
    <ScrollView
      style={styles.screenWrapper}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.screenTitle}>Settings</Text>
      <Text style={styles.screenSubtitle}>
        Manage connectivity, review your session, and sign out securely.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionHeading}>API Base URL</Text>
        <TextInput
          style={styles.input}
          value={rawBaseUrl}
          onChangeText={updateBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://api.cleanuptracker.com"
          placeholderTextColor={COLORS.textSecondary}
        />
        <TouchableOpacity style={styles.outlineButton} onPress={checkConnectivity}>
          <Text style={styles.outlineButtonText}>Check Connectivity</Text>
        </TouchableOpacity>
        <View
          style={[
            styles.statusRow,
            styles.statusChip,
            connectionStatus === 'reachable' && styles.statusChipSuccess,
            connectionStatus === 'error' && styles.statusChipError
          ]}
        >
          <Ionicons
            name={
              connectionStatus === 'reachable'
                ? 'checkmark-circle-outline'
                : connectionStatus === 'error'
                  ? 'alert-circle-outline'
                  : connectionStatus === 'checking'
                    ? 'refresh-outline'
                    : 'radio-outline'
            }
            size={16}
            color={
              connectionStatus === 'reachable'
                ? COLORS.success
                : connectionStatus === 'error'
                  ? COLORS.danger
                  : COLORS.textSecondary
            }
          />
          <Text style={styles.statusChipText}>
            {getStatusText(connectionStatus, rawBaseUrl)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeading}>Session</Text>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Name</Text>
          <Text style={styles.sessionValue}>{session?.user?.name || '—'}</Text>
        </View>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Role</Text>
          <Text style={styles.sessionValue}>{session?.user?.role || '—'}</Text>
        </View>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Employee #</Text>
          <Text style={styles.sessionValue}>{session?.user?.employeeNumber || '—'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, styles.signOutButtonFull]}
          onPress={signOut}
        >
          <LinearGradient
            colors={['#7f1d1d', '#b91c1c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>Sign Out</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  flex: {
    flex: 1
  },
  authContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24
  },
  brandHeader: {
    alignItems: 'center',
    gap: 12
  },
  brandMark: {
    height: 52,
    width: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center'
  },
  brandSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  loginCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    gap: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 }
  },
  loginCardAccent: {
    position: 'absolute',
    inset: 0,
    opacity: 0.08
  },
  loginCardHeader: {
    gap: 10
  },
  loginBadge: {
    height: 40,
    width: 40,
    borderRadius: 14,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  loginSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 33, 46, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 33, 46, 0.35)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  },
  noticeBanner: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  noticeBannerSuccess: {
    backgroundColor: 'rgba(0, 186, 124, 0.14)',
    borderColor: 'rgba(0, 186, 124, 0.3)'
  },
  noticeBannerError: {
    backgroundColor: 'rgba(244, 33, 46, 0.14)',
    borderColor: 'rgba(244, 33, 46, 0.35)'
  },
  noticeBannerInfo: {
    backgroundColor: 'rgba(29, 155, 240, 0.12)',
    borderColor: 'rgba(29, 155, 240, 0.25)'
  },
  noticeText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  },
  pinPanel: {
    gap: 16,
    paddingVertical: 4
  },
  pinBoxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  pinBox: {
    flex: 1,
    minHeight: 70,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pinBoxFilled: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.panelAlt,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 }
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.textPrimary
  },
  pinHintNumber: {
    fontSize: 22,
    color: '#2d323c',
    fontWeight: '700'
  },
  pinHint: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 14,
    letterSpacing: 0.4
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0
  },
  keypad: {
    gap: 16
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 16
  },
  keypadButtonWrapper: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden'
  },
  keypadButton: {
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keypadButtonDigit: {
    borderWidth: 1,
    borderColor: COLORS.border
  },
  keypadButtonAction: {
    borderWidth: 1,
    borderColor: 'transparent'
  },
  keypadButtonLabel: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  keypadButtonDisabled: {
    opacity: 0.6
  },
  primaryButton: {
    borderRadius: 24,
    overflow: 'hidden'
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.4
  },
  buttonDisabled: {
    opacity: 0.6
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel
  },
  statusChipSuccess: {
    borderColor: 'rgba(34,197,94,0.4)',
    backgroundColor: 'rgba(34,197,94,0.12)'
  },
  statusChipError: {
    borderColor: 'rgba(244,63,94,0.4)',
    backgroundColor: 'rgba(244,63,94,0.12)'
  },
  statusChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600'
  },
  connectionCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    gap: 20
  },
  sectionHeading: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  sectionSubheading: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20
  },
  inputGroup: {
    gap: 8
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.panel
  },
  outlineButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingVertical: 14,
    alignItems: 'center'
  },
  outlineButtonText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700'
  },
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  tabLabel: {
    fontSize: 11,
    color: COLORS.textSecondary
  },
  screenWrapper: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 20
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  screenSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  metricCard: {
    flexBasis: '30%',
    flexGrow: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel,
    padding: 16,
    gap: 10
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800'
  },
  metricLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  analyticsCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 20
  },
  analyticsCard: {
    flexBasis: '45%',
    flexGrow: 1,
    backgroundColor: COLORS.panelSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 6
  },
  analyticsCardValue: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800'
  },
  analyticsCardLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  chartCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 12
  },
  chartTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  chartLoading: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  chartEmpty: {
    color: COLORS.textSecondary,
    fontSize: 13
  },
  quickStartCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 12
  },
  quickStartSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13
  },
  salesCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 12
  },
  salesListCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 10
  },
  salesVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  salesVehicleTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  salesVehicleMeta: {
    color: COLORS.textSecondary,
    fontSize: 13
  },
  salesMetaRow: {
    flexDirection: 'row',
    gap: 12
  },
  salesMetaItem: {
    flex: 1,
    gap: 4
  },
  salesMetaLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  salesMetaValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600'
  },
  salesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  salesRowTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  salesRowMeta: {
    color: COLORS.textSecondary,
    fontSize: 13
  },
  salesStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  salesStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  salesTableRow: {
    flexDirection: 'row',
    gap: 12
  },
  salesTableCell: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 13
  },
  detailerList: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 14
  },
  detailerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailerName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700'
  },
  detailerMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  detailerMetricBadge: {
    backgroundColor: `${COLORS.accent}22`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  detailerMetricText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700'
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  rangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.panel
  },
  rangeButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}1a`
  },
  rangeButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '700'
  },
  rangeButtonTextActive: {
    color: COLORS.accent
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionMeta: {
    color: COLORS.textSecondary,
    fontSize: 13
  },
  loadingPane: {
    backgroundColor: COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    gap: 12
  },
  loadingPaneInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14
  },
  jobCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 16
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  jobTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  jobMeta: {
    color: COLORS.textSecondary,
    fontSize: 13
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  jobDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  detailItem: {
    flex: 1,
    gap: 6
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  detailValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600'
  },
  jobActions: {
    flexDirection: 'row',
    gap: 12
  },
  jobActionButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  jobActionPrimary: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  jobActionApprove: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success
  },
  jobActionFlag: {
    borderColor: `${COLORS.danger}55`
  },
  jobActionLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  jobActionPrimaryLabel: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '700'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.panel
  },
  actionButtonText: {
    color: COLORS.accent,
    fontWeight: '700'
  },
  emptyState: {
    backgroundColor: COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    gap: 8
  },
  emptyStateTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center'
  },
  completedCard: {
    backgroundColor: COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  qcCard: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    gap: 16
  },
  qcStatusPill: {
    backgroundColor: `${COLORS.warning}22`,
    borderColor: COLORS.warning
  },
  qcNotesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.panel,
    minHeight: 80
  },
  scannerRoot: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingTop: 80,
    paddingBottom: 80
  },
  scannerDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)'
  },
  scannerHintHeading: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  scannerHintSubheading: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  vinFrame: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  vinCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: COLORS.accent,
    borderWidth: 3
  },
  vinCornerTL: {
    top: -2,
    left: -2,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderBottomWidth: 0,
    borderRightWidth: 0
  },
  vinCornerTR: {
    top: -2,
    right: -2,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    borderBottomWidth: 0,
    borderLeftWidth: 0
  },
  vinCornerBL: {
    bottom: -2,
    left: -2,
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderTopWidth: 0,
    borderRightWidth: 0
  },
  vinCornerBR: {
    bottom: -2,
    right: -2,
    borderLeftColor: 'transparent',
    borderTopColor: 'transparent',
    borderTopWidth: 0,
    borderLeftWidth: 0
  },
  vinGuideLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.accentAlt,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4
  },
  scannerQrSection: {
    alignItems: 'center',
    gap: 6
  },
  scannerQrContainer: {
    borderWidth: 2,
    borderColor: COLORS.success,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  qrCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: COLORS.success,
    borderWidth: 3
  },
  qrCornerTL: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0
  },
  qrCornerTR: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0
  },
  qrCornerBL: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0
  },
  qrCornerBR: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0
  },
  scannerInstructionsBottom: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#000000aa'
  },
  scannerInstructionText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    textAlign: 'center'
  },
  scannerCloseButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.textPrimary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  scannerCloseText: {
    color: COLORS.background,
    fontWeight: '700'
  },
  scannerPermissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 32,
    backgroundColor: COLORS.background
  },
  scannerPermissionText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    textAlign: 'center'
  },
  scannerPermissionButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  scannerPermissionButtonText: {
    color: COLORS.background,
    fontWeight: '700'
  },
  scannerPermissionDismiss: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  scannerPermissionDismissText: {
    color: COLORS.textSecondary,
    fontWeight: '600'
  },
  card: {
    backgroundColor: COLORS.panelSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    gap: 16
  },
  serviceTypeRow: {
    flexDirection: 'row',
    gap: 12
  },
  serviceTypeChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  serviceTypeChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}1a`
  },
  serviceTypeText: {
    color: COLORS.textSecondary,
    fontWeight: '600'
  },
  serviceTypeTextSelected: {
    color: COLORS.accent
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16
  },
  infoTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  sessionLabel: {
    color: COLORS.textSecondary,
    fontSize: 13
  },
  sessionValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600'
  },
  signOutButtonFull: {
    marginTop: 8
  }
});

export default App;
