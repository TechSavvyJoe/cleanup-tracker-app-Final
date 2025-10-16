import React, {
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react';
import { V2 } from '../../utils/v2Client';
import { useToast } from '../../components/Toast';
import {
  ensureServiceTypeCatalog,
  DEFAULT_SERVICE_TYPES,
  createServiceTypeTemplate,
  formatExpectedMinutes,
  SERVICE_TYPE_LIMITS
} from '../../utils/serviceTypes';

function SettingsView({ settings, onSettingsChange }) {
  const toast = useToast();
  const [siteTitle, setSiteTitle] = useState(settings?.siteTitle || 'Cleanup Tracker');
  const [csvUrl, setCsvUrl] = useState(settings?.inventoryCsvUrl || '');
  const [serviceTypes, setServiceTypes] = useState(() => ensureServiceTypeCatalog(settings?.serviceTypes || DEFAULT_SERVICE_TYPES));
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [catalogErrors, setCatalogErrors] = useState({});

  useEffect(() => {
    setSiteTitle(settings?.siteTitle || 'Cleanup Tracker');
    setCsvUrl(settings?.inventoryCsvUrl || '');
    setServiceTypes(ensureServiceTypeCatalog(settings?.serviceTypes || DEFAULT_SERVICE_TYPES));
  }, [settings]);

  useEffect(() => {
    const baseline = ensureServiceTypeCatalog(settings?.serviceTypes || DEFAULT_SERVICE_TYPES);
    const changed =
      (siteTitle || '').trim() !== (settings?.siteTitle || 'Cleanup Tracker') ||
      (csvUrl || '').trim() !== (settings?.inventoryCsvUrl || '') ||
      JSON.stringify(serviceTypes) !== JSON.stringify(baseline);
    setHasUnsavedChanges(changed);
  }, [siteTitle, csvUrl, serviceTypes, settings]);

  const validateCatalog = useCallback((catalog) => {
    const errors = {};
    const names = new Set();
    catalog.forEach((entry) => {
      const issues = [];
      const trimmedName = (entry.name || '').trim();
      if (!trimmedName) {
        issues.push('Name is required');
      } else if (names.has(trimmedName.toLowerCase())) {
        issues.push('Duplicate name');
      }
      names.add(trimmedName.toLowerCase());

      if (!Number.isFinite(entry.expectedMinutes)) {
        issues.push('Duration must be a number');
      } else if (
        entry.expectedMinutes < SERVICE_TYPE_LIMITS.minMinutes ||
        entry.expectedMinutes > SERVICE_TYPE_LIMITS.maxMinutes
      ) {
        issues.push(`Duration must be between ${SERVICE_TYPE_LIMITS.minMinutes} and ${SERVICE_TYPE_LIMITS.maxMinutes} minutes`);
      }

      if (issues.length > 0) {
        errors[entry.id] = issues.join('. ');
      }
    });
    return errors;
  }, []);

  useEffect(() => {
    setCatalogErrors(validateCatalog(serviceTypes));
  }, [serviceTypes, validateCatalog]);

  const defaultServiceTypeId = useMemo(() => serviceTypes[0]?.id || null, [serviceTypes]);
  const hasCatalogErrors = useMemo(() => Object.keys(catalogErrors).length > 0, [catalogErrors]);

  const handleServiceTypeChange = useCallback((id, field, value) => {
    setServiceTypes((prev) => {
      const next = prev.map((entry) => ({ ...entry }));
      const index = next.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return prev;
      }

      if (field === 'expectedMinutes') {
        const numeric = value === '' ? '' : Number(value);
        next[index][field] = Number.isFinite(numeric) ? numeric : '';
      } else {
        next[index][field] = value;
      }

      return next;
    });
  }, []);

  const handleToggleActive = useCallback((id) => {
    setServiceTypes((prev) => prev.map((entry) => (
      entry.id === id ? { ...entry, isActive: !entry.isActive } : entry
    )));
  }, []);

  const handleServiceTypeReorder = useCallback((id, direction) => {
    setServiceTypes((prev) => {
      const index = prev.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return prev;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleSetDefaultServiceType = useCallback((id) => {
    setServiceTypes((prev) => {
      const index = prev.findIndex((entry) => entry.id === id);
      if (index <= 0) {
        return prev;
      }
      const next = [...prev];
      const [entry] = next.splice(index, 1);
      next.unshift(entry);
      return next;
    });
  }, []);

  const handleDuplicateServiceType = useCallback((id) => {
    setServiceTypes((prev) => {
      const index = prev.findIndex((entry) => entry.id === id);
      if (index === -1 || prev.length >= SERVICE_TYPE_LIMITS.maxEntries) {
        return prev;
      }
      const template = createServiceTypeTemplate(`${prev[index].name} Copy`, prev[index]);
      const next = [...prev];
      next.splice(index + 1, 0, template);
      return next;
    });
  }, []);

  const handleRemoveServiceType = useCallback((id) => {
    setServiceTypes((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((entry) => entry.id !== id);
    });
  }, []);

  const handleAddServiceType = useCallback(() => {
    setServiceTypes((prev) => {
      if (prev.length >= SERVICE_TYPE_LIMITS.maxEntries) {
        toast.warning('Service type limit reached');
        return prev;
      }
      return [...prev, createServiceTypeTemplate(`New Service ${prev.length + 1}`)];
    });
  }, [toast]);

  const persistCoreSettings = useCallback(async () => {
    const trimmedTitle = siteTitle.trim() || 'Cleanup Tracker';
    const trimmedUrl = (csvUrl || '').trim();

    const updates = [
      V2.put('/settings', { key: 'siteTitle', value: trimmedTitle })
    ];

    if (trimmedUrl) {
      updates.push(
        V2.post('/vehicles/set-csv', { url: trimmedUrl }).catch(async () => {
          await V2.put('/settings', { key: 'inventoryCsvUrl', value: trimmedUrl });
        })
      );
    } else {
      updates.push(V2.put('/settings', { key: 'inventoryCsvUrl', value: '' }));
    }

    await Promise.all(updates);
  }, [siteTitle, csvUrl]);

  const persistServiceCatalog = useCallback(async () => {
    const sanitizedCatalog = ensureServiceTypeCatalog(serviceTypes);
    await V2.put('/settings', { key: 'serviceTypes', value: sanitizedCatalog });
    return sanitizedCatalog;
  }, [serviceTypes]);

  const saveAll = useCallback(async ({ showToast = true } = {}) => {
    setSaving(true);
    try {
      await persistCoreSettings();
      const catalog = await persistServiceCatalog();
      const res = await V2.get('/settings');
      const nextSettings = res.data || {};
      onSettingsChange(nextSettings);
      setServiceTypes(ensureServiceTypeCatalog(nextSettings.serviceTypes || catalog));
      setHasUnsavedChanges(false);
      if (showToast) {
        toast.success('Settings updated');
      }
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Failed to save settings';
      toast.error(message);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [persistCoreSettings, persistServiceCatalog, onSettingsChange, toast]);

  const handleSaveAndImport = useCallback(async () => {
    try {
      await saveAll({ showToast: false });
      await V2.post('/vehicles/refresh');
      toast.success('Settings saved and inventory refreshed');
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Inventory refresh failed';
      toast.error(message);
    }
  }, [saveAll, toast]);

  const handleRefreshInventory = useCallback(async () => {
    try {
      await V2.post('/vehicles/refresh');
      toast.info('Inventory refresh triggered');
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Inventory refresh failed';
      toast.error(message);
    }
  }, [toast]);

  const disableSaveButton = saving || hasCatalogErrors;

  return (
    <div className="space-y-6 text-[color:var(--x-text-primary)]">
      <section className="x-card x-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="x-title">General</h3>
            <p className="x-subtitle">Controls the display shell for the Cleanup Tracker experience.</p>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-xs uppercase tracking-[0.2em] text-amber-400">Unsaved changes</span>
            )}
            <button
              type="button"
              onClick={() => saveAll()}
              disabled={!hasUnsavedChanges || disableSaveButton}
              className={`x-button ${disableSaveButton || !hasUnsavedChanges ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
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
            <p className="text-xs text-[color:var(--x-text-subtle)]">Displayed in the login experience and header brand lockup.</p>
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
            <p className="text-xs text-[color:var(--x-text-subtle)]">Supports live updates; use the published CSV link from Google Sheets.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveAll()}
              disabled={!hasUnsavedChanges || disableSaveButton}
              className={`x-button ${disableSaveButton || !hasUnsavedChanges ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleSaveAndImport}
              disabled={saving || hasCatalogErrors}
              className={`x-button x-button--accent ${saving || hasCatalogErrors ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              Sync CSV &amp; Refresh Inventory
            </button>
            <button
              type="button"
              onClick={handleRefreshInventory}
              className="x-button x-button--secondary"
            >
              Refresh Inventory Only
            </button>
          </div>
        </div>
      </section>

      <section className="x-card x-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="x-title">Service Catalog</h3>
            <p className="x-subtitle">Define the services, durations, and availability your team can schedule.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[color:var(--x-text-subtle)]">{serviceTypes.length}/{SERVICE_TYPE_LIMITS.maxEntries} configured</span>
            <button
              type="button"
              onClick={handleAddServiceType}
              className="x-button x-button--secondary"
            >
              Add service type
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {serviceTypes.map((service, index) => {
            const error = catalogErrors[service.id];
            const isDefault = service.id === defaultServiceTypeId;
            return (
              <div key={service.id} className="rounded-xl border border-[color:var(--x-border-strong)] bg-[color:var(--x-surface-raised)] p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="x-subtitle" htmlFor={`service-name-${service.id}`}>Service name</label>
                    <input
                      id={`service-name-${service.id}`}
                      type="text"
                      value={service.name}
                      onChange={(e) => handleServiceTypeChange(service.id, 'name', e.target.value)}
                      className="x-input"
                      placeholder="Premium Detail"
                    />
                    <p className="text-xs text-[color:var(--x-text-subtle)]">Visible in job creation flows and reporting.</p>
                  </div>

                  <div className="md:w-56">
                    <label className="x-subtitle" htmlFor={`service-duration-${service.id}`}>Target duration (minutes)</label>
                    <div className="flex items-center gap-3">
                      <input
                        id={`service-duration-${service.id}`}
                        type="number"
                        min={SERVICE_TYPE_LIMITS.minMinutes}
                        max={SERVICE_TYPE_LIMITS.maxMinutes}
                        value={service.expectedMinutes}
                        onChange={(e) => handleServiceTypeChange(service.id, 'expectedMinutes', e.target.value)}
                        className="x-input"
                      />
                      <span className="text-xs text-[color:var(--x-text-subtle)] whitespace-nowrap">{formatExpectedMinutes(service.expectedMinutes)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-[0.15em] text-[color:var(--x-text-subtle)]">Active</span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(service.id)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition ${service.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}
                    >
                      {service.isActive ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="x-subtitle" htmlFor={`service-description-${service.id}`}>Description</label>
                  <textarea
                    id={`service-description-${service.id}`}
                    value={service.description}
                    onChange={(e) => handleServiceTypeChange(service.id, 'description', e.target.value)}
                    className="x-input min-h-[72px]"
                    placeholder="Fast track reconditioning for frontline units."
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isDefault ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200">
                      Default selection
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefaultServiceType(service.id)}
                      className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300 hover:text-blue-200"
                    >
                      Make default
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleServiceTypeReorder(service.id, 'up')}
                    disabled={index === 0}
                    className={`text-xs uppercase tracking-[0.15em] ${index === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-[color:var(--x-text-subtle)] hover:text-white'}`}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    onClick={() => handleServiceTypeReorder(service.id, 'down')}
                    disabled={index === serviceTypes.length - 1}
                    className={`text-xs uppercase tracking-[0.15em] ${index === serviceTypes.length - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-[color:var(--x-text-subtle)] hover:text-white'}`}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateServiceType(service.id)}
                    className="text-xs uppercase tracking-[0.15em] text-[color:var(--x-text-subtle)] hover:text-white"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveServiceType(service.id)}
                    disabled={serviceTypes.length === 1}
                    className={`text-xs uppercase tracking-[0.15em] ${serviceTypes.length === 1 ? 'text-gray-600 cursor-not-allowed' : 'text-red-300 hover:text-red-200'}`}
                  >
                    Remove
                  </button>
                </div>

                {error && (
                  <p className="mt-3 text-xs text-red-300">{error}</p>
                )}
              </div>
            );
          })}

          {serviceTypes.length === 0 && (
            <div className="rounded-xl border border-dashed border-[color:var(--x-border-muted)] bg-black/40 p-6 text-center text-sm text-[color:var(--x-text-subtle)]">
              No service types configured. Add at least one to unlock job scheduling.
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAddServiceType}
            className="x-button x-button--secondary"
          >
            Add service type
          </button>
          <button
            type="button"
            onClick={() => saveAll()}
            disabled={!hasUnsavedChanges || disableSaveButton}
            className={`x-button ${disableSaveButton || !hasUnsavedChanges ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {saving ? 'Saving…' : 'Publish updates'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default SettingsView;
