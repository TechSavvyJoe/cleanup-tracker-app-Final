import React, { useState, useEffect } from 'react';
import { V2 } from '../../utils/v2Client';

function SettingsView({ settings, onSettingsChange }) {
  const [siteTitle, setSiteTitle] = useState(settings?.siteTitle || 'Cleanup Tracker');
  const [csvUrl, setCsvUrl] = useState(settings?.inventoryCsvUrl || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSiteTitle(settings?.siteTitle || 'Cleanup Tracker');
    setCsvUrl(settings?.inventoryCsvUrl || '');
  }, [settings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save site title
      await V2.put('/settings', { key: 'siteTitle', value: siteTitle });
      // Save CSV URL using settings (and also set-csv for compatibility)
      if (csvUrl?.trim()) {
        try {
          await V2.post('/vehicles/set-csv', { url: csvUrl.trim() });
        } catch (_) {
          // fallback to generic settings endpoint
          await V2.put('/settings', { key: 'inventoryCsvUrl', value: csvUrl.trim() });
        }
      }
      const res = await V2.get('/settings');
      onSettingsChange(res.data || {});
      alert('Settings saved.');
    } catch (err) {
      alert('Failed to save settings: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const saveAndImport = async () => {
    await saveSettings();
    try {
      await V2.post('/vehicles/refresh');
      alert('Inventory refreshed from CSV.');
    } catch (err) {
      alert('Refresh failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const refreshOnly = async () => {
    try {
      await V2.post('/vehicles/refresh');
      alert('Inventory refreshed.');
    } catch (err) {
      alert('Refresh failed: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6 text-[color:var(--x-text-primary)]">
      <section className="x-card x-fade-in">
        <div className="space-y-2">
          <h3 className="x-title">General</h3>
          <p className="x-subtitle">Controls the display shell for the Cleanup Tracker experience.</p>
        </div>

        <div className="x-stack mt-6">
          <div className="x-stack">
            <label className="x-subtitle" htmlFor="settings-site-title">Site Title</label>
            <input
              id="settings-site-title"
              type="text"
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              className="x-input"
              placeholder="Cleanup Tracker"
            />
          </div>
        </div>
      </section>

      <section className="x-card x-fade-in">
        <div className="space-y-2">
          <h3 className="x-title">Inventory Source</h3>
          <p className="x-subtitle">Connect the live Google Sheets feed for vehicle inventory.</p>
        </div>

        <div className="x-stack mt-6">
          <div className="x-stack">
            <label className="x-subtitle" htmlFor="settings-csv-url">Google Sheets CSV URL</label>
            <input
              id="settings-csv-url"
              type="url"
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
              className="x-input"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveSettings} disabled={saving} className="x-button">
              Save
            </button>
            <button onClick={saveAndImport} disabled={saving} className="x-button x-button--accent">
              Save &amp; Import
            </button>
            <button onClick={refreshOnly} className="x-button x-button--secondary">
              Refresh Inventory
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
export default SettingsView;
