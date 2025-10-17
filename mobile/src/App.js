import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { loginUser, getDashboardSummary } from './api/auth';

const DEFAULT_API_BASE = Constants.expoConfig?.extra?.apiBaseUrl || 'http://127.0.0.1:5051';

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);
  const [pin, setPin] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);

  const resetState = () => {
  setSession(null);
    setSummary(null);
    setPin('');
  };

  const handleLogin = async () => {
    if (!pin.trim()) {
      Alert.alert('PIN required', 'Enter the 4-8 digit PIN assigned to your user.');
      return;
    }

    setLoading(true);
    try {
  const data = await loginUser({ baseUrl: apiBaseUrl, employeeId, pin });
  setSession(data);
  setSummary(null);
  Alert.alert('Login successful', `Welcome back, ${data.user?.name || 'team member'}!`);
    } catch (error) {
      console.error('Login failed', error);
      const message = error.response?.data?.error || error.message || 'Login failed';
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSummary = async () => {
    if (!session?.tokens?.accessToken) {
      Alert.alert('Login required', 'Log in before requesting summary data.');
      return;
    }

    setLoading(true);
    try {
      const data = await getDashboardSummary({
        baseUrl: apiBaseUrl,
        token: session.tokens.accessToken
      });
      setSummary(data);
    } catch (error) {
      console.error('Summary fetch failed', error);
      const message = error.response?.data?.error || error.message || 'Unable to load summary';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Cleanup Tracker Mobile</Text>
          <Text style={styles.subtitle}>
            Connects to your existing Cleanup Tracker backend so you can smoke-test flows inside the
            iOS simulator.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>API Base URL</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              value={apiBaseUrl}
              onChangeText={setApiBaseUrl}
              placeholder="http://127.0.0.1:5051"
            />

            <Text style={styles.label}>Employee ID (optional)</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              value={employeeId}
              onChangeText={setEmployeeId}
              placeholder="MGR001"
            />

            <Text style={styles.label}>PIN</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              keyboardType="number-pad"
              value={pin}
              onChangeText={setPin}
              placeholder="1701"
            />

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>

            {session && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={resetState}
                disabled={loading}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Sign Out</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Talking to backend…</Text>
            </View>
          )}

          {session && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Signed-in User</Text>
              <Text style={styles.fieldLabel}>Name</Text>
              <Text style={styles.value}>{session.user?.name}</Text>

              <Text style={styles.fieldLabel}>Role</Text>
              <Text style={styles.value}>{session.user?.role}</Text>

              <Text style={styles.fieldLabel}>Employee #</Text>
              <Text style={styles.value}>{session.user?.employeeNumber || '—'}</Text>

              <TouchableOpacity style={styles.button} onPress={handleFetchSummary} disabled={loading}>
                <Text style={styles.buttonText}>Load Dashboard Summary</Text>
              </TouchableOpacity>
            </View>
          )}

          {summary && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Today&apos;s Snapshot</Text>
              <Text style={styles.value}>Open Jobs: {summary.openJobs ?? 'n/a'}</Text>
              <Text style={styles.value}>Completed Today: {summary.completedToday ?? 'n/a'}</Text>
              <Text style={styles.value}>Average Duration: {summary.averageDuration ?? 'n/a'} mins</Text>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Tip: When running in the iOS simulator, keep your Node backend running on the host
              machine and set the API base URL to the host IP (e.g. http://192.168.68.118:5051).
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6fb'
  },
  flex: {
    flex: 1
  },
  container: {
    padding: 24,
    gap: 20
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: '#475467'
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
    gap: 12
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#475467'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0'
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16
  },
  secondaryButtonText: {
    color: '#1e293b'
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  loadingText: {
    fontSize: 16,
    color: '#475467'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475467',
    marginTop: 4
  },
  value: {
    fontSize: 16,
    color: '#1f2937'
  },
  footer: {
    paddingBottom: 40
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    color: '#64748b'
  }
});
