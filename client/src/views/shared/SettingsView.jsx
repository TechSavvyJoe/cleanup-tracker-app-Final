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
    setServiceTypes((prev) => prev.map((entry) => {
      if (entry.id !== id) {
        return entry;
      }
      const currentlyActive = entry.isActive !== false;
      const next = { ...entry, isActive: !currentlyActive };
      if (next.isActive) {
        delete next.isActive;
      }
      return next;
    }));
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
  const activeServiceCount = serviceTypes.filter((entry) => entry.isActive !== false).length;
  const inventoryConnected = Boolean((csvUrl || settings?.inventoryCsvUrl || '').trim());
  const defaultServiceName = serviceTypes.find((entry) => entry.id === defaultServiceTypeId)?.name || 'Not set';

  return (
    <div className="space-y-8 text-[color:var(--x-text-primary)]">
      <header className="bg-gradient-to-r from-blue-500/10 via-blue-600/5 to-transparent border border-blue-600/20 rounded-3xl px-6 py-5 shadow-lg shadow-blue-500/5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-200">Workspace Settings</p>
            <h2 className="mt-2 text-2xl lg:text-3xl font-semibold text-white">Shape the Cleanup Tracker experience</h2>
            <p className="mt-2 text-sm text-blue-100/80 max-w-2xl">
              Update branding, inventory sources, and service offerings. Changes apply instantly across dashboard, kiosks, and the mobile app.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {hasUnsavedChanges && (
              <span className="inline-flex items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              onClick={() => saveAll()}
              disabled={!hasUnsavedChanges || disableSaveButton}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                !hasUnsavedChanges || disableSaveButton
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-black hover:from-emerald-500 hover:to-emerald-700 shadow-lg shadow-emerald-500/20'
              }`}
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Save changes
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-black/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Workspace title</p>
            <p className="mt-1 text-lg font-semibold text-white">{siteTitle || 'Cleanup Tracker'}</p>
            <p className="mt-1 text-xs text-gray-500">Shown on login and in the top navigation.</p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-black/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Inventory feed</p>
            <p className={`mt-1 text-lg font-semibold ${inventoryConnected ? 'text-emerald-300' : 'text-amber-300'}`}>
              {inventoryConnected ? 'Connected' : 'Not configured'}
            </p>
            <p className="mt-1 text-xs text-gray-500">Uses a published CSV from Google Sheets.</p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-black/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Service catalog</p>
            <p className="mt-1 text-lg font-semibold text-white">{serviceTypes.length} total • {activeServiceCount} active</p>
            <p className="mt-1 text-xs text-gray-500">Default package: <span className="text-blue-200 font-semibold">{defaultServiceName}</span></p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_minmax(320px,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-800 bg-black/70 px-6 py-6 shadow-xl shadow-black/20">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Branding</p>
                <h3 className="text-white text-lg font-semibold">Workspace identity</h3>
                <p className="text-sm text-gray-500">Set the title that appears across login, dashboard headers, and emails.</p>
              </div>
              {hasUnsavedChanges && (
                <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 uppercase tracking-[0.2em]">
                  Pending save
                </span>
              )}
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor="settings-site-title">Workspace title</label>
                <input
                  id="settings-site-title"
                  type="text"
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-700 bg-black py-2.5 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cleanup Tracker"
                />
                <p className="mt-1 text-xs text-gray-500">Keep it short and instantly recognizable.</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4 py-4 text-xs text-gray-500">
                <p>Tip: include your dealership or campus name to help technicians confirm they are in the right workspace.</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-800 bg-black/70 px-6 py-6 shadow-xl shadow-black/15">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Inventory feed</p>
                <h3 className="text-white text-lg font-semibold">Google Sheets connection</h3>
                <p className="text-sm text-gray-500">Sync vehicle availability via the published CSV link. Changes push to the board automatically.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveAll()}
                  disabled={!hasUnsavedChanges || disableSaveButton}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${!hasUnsavedChanges || disableSaveButton ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30'}`}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndImport}
                  disabled={saving || hasCatalogErrors}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${saving || hasCatalogErrors ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-black hover:from-emerald-500 hover:to-emerald-700'}`}
                >
                  Sync & refresh inventory
                </button>
                <button
                  type="button"
                  onClick={handleRefreshInventory}
                  className="rounded-full px-4 py-2 text-sm font-semibold border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                >
                  Refresh only
                </button>
              </div>
            </div>
            <div className="mt-5">
              <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor="settings-csv-url">Published CSV URL</label>
              <input
                id="settings-csv-url"
                type="url"
                value={csvUrl}
                onChange={(e) => setCsvUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
                className="mt-2 w-full rounded-xl border border-gray-700 bg-black py-2.5 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Use <span className="text-blue-300">File → Share → Publish to web → CSV</span> in Google Sheets.</p>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-800 bg-black/70 px-6 py-6 shadow-xl shadow-black/15">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Service catalog</p>
                <h3 className="text-white text-lg font-semibold">Packages & expectations</h3>
                <p className="text-sm text-gray-500">Adjust offerings, durations, and availability. Updates appear instantly in job creation.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-400">
                  {serviceTypes.length}/{SERVICE_TYPE_LIMITS.maxEntries} configured
                </span>
                <button
                  type="button"
                  onClick={handleAddServiceType}
                  className="rounded-full border border-blue-500/50 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/10"
                >
                  Add service type
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              {serviceTypes.map((service, index) => {
                const error = catalogErrors[service.id];
                const isDefault = service.id === defaultServiceTypeId;
                const canMoveUp = index > 0;
                const canMoveDown = index < serviceTypes.length - 1;
                const onlyOne = serviceTypes.length === 1;

                return (
                  <div key={service.id} className="rounded-3xl border border-gray-800 bg-black/60 px-5 py-5 shadow-inner">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                      <div className="flex-1 space-y-2">
                        <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor={`service-name-${service.id}`}>Service name</label>
                        <input
                          id={`service-name-${service.id}`}
                          type="text"
                          value={service.name}
                          onChange={(e) => handleServiceTypeChange(service.id, 'name', e.target.value)}
                          className="w-full rounded-xl border border-gray-700 bg-black py-2.5 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Premium Detail"
                        />
                        <p className="text-xs text-gray-500">Visible in job launch flows and reporting.</p>
                      </div>
                      <div className="lg:w-52 space-y-2">
                        <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor={`service-duration-${service.id}`}>Duration (minutes)</label>
                        <div className="flex items-center gap-3">
                          <input
                            id={`service-duration-${service.id}`}
                            type="number"
                            min={SERVICE_TYPE_LIMITS.minMinutes}
                            max={SERVICE_TYPE_LIMITS.maxMinutes}
                            value={service.expectedMinutes}
                            onChange={(e) => handleServiceTypeChange(service.id, 'expectedMinutes', e.target.value)}
                            className="w-full rounded-xl border border-gray-700 bg-black py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500 whitespace-nowrap">{formatExpectedMinutes(service.expectedMinutes)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Status</span>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(service.id)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${service.isActive !== false ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}
                        >
                          {service.isActive !== false ? 'Active' : 'Disabled'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor={`service-description-${service.id}`}>Description</label>
                        <textarea
                          id={`service-description-${service.id}`}
                          value={service.description}
                          onChange={(e) => handleServiceTypeChange(service.id, 'description', e.target.value)}
                          className="mt-2 w-full rounded-xl border border-gray-700 bg-black py-3 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[72px]"
                          placeholder="Fast track reconditioning for frontline units."
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {isDefault ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/15 px-3 py-1 font-semibold text-blue-200 uppercase tracking-[0.2em]">
                            Default selection
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultServiceType(service.id)}
                            className="text-blue-300 hover:text-blue-100 font-semibold uppercase tracking-[0.2em]"
                          >
                            Make default
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleServiceTypeReorder(service.id, 'up')}
                          disabled={!canMoveUp}
                          className={`uppercase tracking-[0.2em] ${canMoveUp ? 'text-gray-400 hover:text-white' : 'text-gray-600 cursor-not-allowed'}`}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => handleServiceTypeReorder(service.id, 'down')}
                          disabled={!canMoveDown}
                          className={`uppercase tracking-[0.2em] ${canMoveDown ? 'text-gray-400 hover:text-white' : 'text-gray-600 cursor-not-allowed'}`}
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateServiceType(service.id)}
                          className="text-gray-400 hover:text-white uppercase tracking-[0.2em]"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveServiceType(service.id)}
                          disabled={onlyOne}
                          className={`text-red-300 hover:text-red-200 uppercase tracking-[0.2em] ${onlyOne ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          Remove
                        </button>
                      </div>

                      {error && (
                        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                          {error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {serviceTypes.length === 0 && (
                <div className="rounded-3xl border border-dashed border-gray-700 bg-black/50 px-6 py-8 text-center text-sm text-gray-500">
                  No service types configured. Add at least one to unlock job scheduling.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-gray-800 bg-black/70 px-6 py-5 shadow-lg shadow-black/20">
            <h4 className="text-white text-base font-semibold">Quick actions</h4>
            <p className="mt-1 text-sm text-gray-500">Shortcuts for after catalog or inventory updates.</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <button
                type="button"
                onClick={() => saveAll()}
                disabled={!hasUnsavedChanges || disableSaveButton}
                className={`rounded-xl px-4 py-3 text-left font-semibold transition ${!hasUnsavedChanges || disableSaveButton ? 'bg-gray-900 text-gray-600 cursor-not-allowed' : 'bg-blue-500/15 text-blue-200 hover:bg-blue-500/25'}`}
              >
                Save workspace changes
              </button>
              <button
                type="button"
                onClick={handleSaveAndImport}
                disabled={saving || hasCatalogErrors}
                className={`rounded-xl px-4 py-3 text-left font-semibold transition ${saving || hasCatalogErrors ? 'bg-gray-900 text-gray-600 cursor-not-allowed' : 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'}`}
              >
                Save & refresh inventory feed
              </button>
              <button
                type="button"
                onClick={handleRefreshInventory}
                className="rounded-xl border border-gray-700 px-4 py-3 text-left font-semibold text-gray-300 hover:text-white hover:border-gray-500"
              >
                Trigger inventory refresh only
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-500">Need different environments? Configure API keys and staging connections in <span className="text-blue-300">Developer Tools</span>.</p>
          </div>

          <div className="rounded-3xl border border-gray-800 bg-black/70 px-6 py-5 shadow-lg shadow-black/20">
            <h4 className="text-white text-base font-semibold">Catalog health</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li>• {activeServiceCount} active service{activeServiceCount === 1 ? '' : 's'} available to detailers.</li>
              <li>• Default package: <span className="text-white font-semibold">{defaultServiceName}</span>.</li>
              <li>• Inventory feed is {inventoryConnected ? <span className="text-emerald-300">connected</span> : <span className="text-amber-300">not connected</span>}.</li>
              {hasCatalogErrors ? <li className="text-red-300">• Resolve catalog validation errors before saving.</li> : null}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default SettingsView;
