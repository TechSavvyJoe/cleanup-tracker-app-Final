import React, { useState } from 'react';
import { V2 } from '../../utils/v2Client';

// Personal Settings View (for both roles)
function MySettingsView({ user }) {
  const [name, setName] = useState(user?.name || '');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return alert('Name is required');
    
    // Restrict PIN changes for detailers
    if ((user.role === 'detailer' || user.role === 'technician') && pin) {
      return alert('PIN changes are not allowed for detailers. Contact your manager.');
    }
    
    if (pin && pin.length !== 4) return alert('PIN must be 4 digits');
    setSaving(true);
    try {
      // Fetch latest user from API list to get ID mapping
      const all = await V2.get('/users');
      const me = (all.data || []).find(u => u.id === user.id || u.pin === user.pin || u.name === user.name);
      if (!me) return alert('Cannot locate your profile');
      
      // Only include PIN in update if user is manager
      const updateData = { name, role: me.role };
      if (user.role === 'manager' && pin) {
        updateData.pin = pin;
      }
      
      await V2.put(`/users/${me.id}`, updateData);
      alert('Profile updated');
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 text-[color:var(--x-text-primary)]">
      <div className="x-card x-fade-in">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h3 className="x-title">Profile Preferences</h3>
            <p className="x-subtitle">Optimized for the X experience</p>
          </div>
          <span className="x-badge">{user.role}</span>
        </div>

        <div className="x-stack">
          <div className="x-stack">
            <label className="x-subtitle" htmlFor="my-settings-display-name">Display Name</label>
            <input
              id="my-settings-display-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="x-input"
              placeholder="How teammates see you"
            />
          </div>

          {user.role === 'manager' && (
            <div className="x-stack">
              <label className="x-subtitle" htmlFor="my-settings-pin">New PIN (optional)</label>
              <input
                id="my-settings-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="x-input"
                placeholder="4 digits"
              />
              <p className="text-xs text-[color:var(--x-text-secondary)] uppercase tracking-[0.2em]">Requires 4 digits</p>
            </div>
          )}

          {(user.role === 'detailer' || user.role === 'technician') && (
            <div className="x-banner flex items-center gap-3">
              <span className="x-icon-chip">🔒</span>
              <p className="text-sm">
                PIN changes are managed by your supervisor. Reach out to your manager for updates.
              </p>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="x-button w-full"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
export default MySettingsView;
