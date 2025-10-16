import React, { useState, useEffect, useMemo } from 'react';
import { v2Request } from '../utils/v2Client';
import { useToast } from './Toast';

const EnterpriseInventory = ({
  theme = 'dark',
  onCreateJob,
  onEditVehicle,
  onPrintVehicle,
  currentUser,
  onVehicleUpdated
}) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [, setShowAddForm] = useState(false);
  const [jobLoadingId, setJobLoadingId] = useState(null);
  const [editVehicleData, setEditVehicleData] = useState(null);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const toast = useToast();

  const statusOptions = useMemo(() => ([
    { value: 'available', label: 'Available' },
    { value: 'in-service', label: 'In Service' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'sold', label: 'Sold' }
  ]), []);

  const currencyFormatter = useMemo(() => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }), []);

  const mileageFormatter = useMemo(() => new Intl.NumberFormat('en-US'), []);

  const getVehicleIdentifier = (vehicle) => {
    if (!vehicle) return null;
    return vehicle._id || vehicle.id || vehicle.vin || vehicle.stockNumber || null;
  };

  const normalizeStatus = (status) => {
    if (!status) return '';
    return status.toString().trim().toLowerCase().replace(/\s+/g, '-');
  };

  const buildVehicleTitle = (vehicle) => {
    if (!vehicle) return 'Vehicle';
    const composed = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ').trim();
    if (composed) return composed;
    return vehicle.vehicle || 'Vehicle';
  };

  const formatStatusLabel = (status) => {
    if (!status) return 'Unknown';
    return status
      .toString()
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const sanitizePriceForPayload = (value) => {
    if (value == null) return '';
    const numeric = String(value).replace(/[^0-9.]/g, '');
    if (!numeric) return '';
    const parsed = Number(numeric);
    if (!Number.isFinite(parsed)) {
      return String(value).trim();
    }
    const rounded = Math.round(parsed);
    return `$${rounded.toLocaleString('en-US')}`;
  };

  const sanitizeOdometerForPayload = (value) => {
    if (value == null) return '';
    const numeric = String(value).replace(/[^0-9]/g, '');
    if (!numeric) return '';
    const parsed = Number(numeric);
    if (!Number.isFinite(parsed)) {
      return String(value).trim();
    }
    return parsed.toLocaleString('en-US');
  };

  // Load vehicles data
  useEffect(() => {
    let isActive = true;

    const loadVehicles = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await v2Request('get', '/vehicles', null, {
          params: { limit: 500 },
          headers: { Accept: 'application/json' }
        });

        const payload = response?.data;
        if (!isActive) return;

        if (Array.isArray(payload)) {
          setVehicles(payload);
        } else if (payload?.success && Array.isArray(payload.vehicles)) {
          setVehicles(payload.vehicles);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        if (!isActive) return;
        console.error('Failed to load vehicles:', err);
        setError(err.message || 'Failed to load vehicles');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadVehicles();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedVehicle) {
      setEditVehicleData(null);
      setIsSavingVehicle(false);
    }
  }, [selectedVehicle]);

  // Enhanced filtering and sorting
  const filteredAndSortedVehicles = useMemo(() => {
    let filtered = vehicles.filter(vehicle => {
      const matchesSearch = searchTerm === '' ||
        vehicle.vin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.stockNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.year?.toString().includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || vehicle.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });

    // Sort vehicles
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'year') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [vehicles, searchTerm, statusFilter, sortBy, sortOrder]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200';
      case 'in-service':
        return 'border-amber-400/70 bg-amber-500/20 text-amber-200';
      case 'maintenance':
        return 'border-rose-400/70 bg-rose-500/20 text-rose-200';
      case 'sold':
        return 'border-slate-500/70 bg-slate-500/20 text-slate-200';
      default:
        return 'border-sky-400/60 bg-sky-500/15 text-sky-200';
    }
  };

  const asNumber = (value) => {
    if (value == null) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const cleaned = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(cleaned) ? cleaned : null;
  };

  const handleCreateJobClick = async (vehicle) => {
    if (!vehicle) return;
    const vehicleId = getVehicleIdentifier(vehicle);
    if (vehicleId && jobLoadingId === vehicleId) {
      return;
    }

    try {
      if (vehicleId) {
        setJobLoadingId(vehicleId);
      }

      if (typeof onCreateJob === 'function') {
        await onCreateJob(vehicle);
        return;
      }

      const technicianId = currentUser?.id || currentUser?._id || currentUser?.pin || 'inventory-manager';
      const technicianName = currentUser?.name || currentUser?.displayName || 'Inventory Manager';
      const payload = {
        technicianId,
        technicianName,
        vin: vehicle.vin || 'UNKNOWN_VIN',
        stockNumber: vehicle.stockNumber || '',
        vehicleDescription: buildVehicleTitle(vehicle),
        serviceType: 'Cleanup',
        priority: 'Normal',
        year: vehicle.year || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        vehicleColor: vehicle.color || ''
      };

      await v2Request('post', '/jobs', payload);

      if (typeof onVehicleUpdated === 'function') {
        onVehicleUpdated({ ...vehicle });
      }
      toast.success(`Created job for ${buildVehicleTitle(vehicle)}.`);
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Failed to create job';
      toast.error(message);
      console.error('Create job from inventory failed:', error);
    } finally {
      setJobLoadingId(null);
    }
  };

  const beginEditingVehicle = (vehicle) => {
    if (!vehicle) return;
    const identifier = getVehicleIdentifier(vehicle);
    setSelectedVehicle(vehicle);
    setEditVehicleData({
      id: identifier,
  status: normalizeStatus(vehicle.status || 'available'),
      price: vehicle.price ? String(vehicle.price) : '',
      odometer: vehicle.odometer || vehicle.mileage || '',
      color: vehicle.color || '',
      location: vehicle.location || '',
      detailPackage: vehicle.detailPackage || '',
      tags: vehicle.tags || '',
      notes: vehicle.notes || ''
    });
  };

  const handleEditVehicleClick = (vehicle) => {
    if (typeof onEditVehicle === 'function') {
      onEditVehicle(vehicle);
      return;
    }
    beginEditingVehicle(vehicle);
  };

  const handlePrintVehicle = (vehicle) => {
    if (typeof onPrintVehicle === 'function') {
      onPrintVehicle(vehicle);
      return;
    }

    const printWindow = window.open('', '_blank', 'width=640,height=800');
    if (!printWindow) {
      console.warn('Pop-up blocked: unable to open print preview.');
      return;
    }

    const rows = [
      ['Vehicle', `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim()],
      ['Trim', vehicle.trim || '—'],
      ['Stock #', vehicle.stockNumber || '—'],
      ['VIN', vehicle.vin || '—'],
      ['Status', vehicle.status || 'Unknown'],
      ['Color', vehicle.color || '—'],
      ['Location', vehicle.location || vehicle.lot || '—'],
      ['Mileage', vehicle.mileage != null ? mileageFormatter.format(vehicle.mileage) : '—'],
      ['Price', vehicle.price ? currencyFormatter.format(Number(vehicle.price)) : '—'],
    ];

    printWindow.document.write('<html><head><title>Vehicle Spec Sheet</title>');
    printWindow.document.write('<style>body{font-family:Inter,Arial,sans-serif;padding:32px;color:#0f172a;}h1{font-size:24px;margin-bottom:16px;}table{width:100%;border-collapse:collapse;}td{padding:8px 12px;border-bottom:1px solid #cbd5f5;font-size:14px;}td:first-child{font-weight:600;width:160px;color:#475569;}tfoot td{text-align:center;padding-top:24px;font-size:12px;color:#94a3b8;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<h1>Vehicle Spec Sheet</h1>`);
    printWindow.document.write('<table>');
    rows.forEach(([label, value]) => {
      printWindow.document.write(`<tr><td>${label}</td><td>${value}</td></tr>`);
    });
    printWindow.document.write('<tfoot><tr><td colspan="2">Generated by CleanUp Tracker</td></tr></tfoot>');
    printWindow.document.write('</table></body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleEditFieldChange = (field, value) => {
    setEditVehicleData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleVehicleSave = async (event) => {
    event?.preventDefault();
    if (!selectedVehicle || !editVehicleData) return;

    const identifier = getVehicleIdentifier(selectedVehicle);
    if (!identifier) {
      toast.error('Unable to identify this vehicle.');
      return;
    }

    const payload = {
      status: (editVehicleData.status || 'available').toLowerCase(),
      price: sanitizePriceForPayload(editVehicleData.price),
      odometer: sanitizeOdometerForPayload(editVehicleData.odometer),
      color: editVehicleData.color?.trim() || '',
      location: editVehicleData.location?.trim() || '',
      detailPackage: editVehicleData.detailPackage?.trim() || '',
      tags: editVehicleData.tags?.trim() || '',
      notes: editVehicleData.notes?.trim() || ''
    };

    setIsSavingVehicle(true);

    try {
      const response = await v2Request('put', `/vehicles/${encodeURIComponent(identifier)}`, payload);
      const updatedVehicle = response?.data?.vehicle || response?.data;

      if (updatedVehicle) {
        setVehicles((prev) => prev.map((item) => {
          const currentId = getVehicleIdentifier(item);
          const updatedId = getVehicleIdentifier(updatedVehicle);
          return currentId && updatedId && currentId === updatedId ? updatedVehicle : item;
        }));
        setSelectedVehicle(updatedVehicle);
        if (typeof onVehicleUpdated === 'function') {
          onVehicleUpdated(updatedVehicle);
        }
      }

      toast.success('Vehicle updated successfully.');
      setEditVehicleData(null);
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Failed to update vehicle';
      toast.error(message);
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const renderVehicleModal = () => {
    if (!selectedVehicle) {
      return null;
    }

    const priceValue = asNumber(selectedVehicle.price);
    const priceLabel = priceValue != null ? currencyFormatter.format(priceValue) : '—';
    const mileageValue = asNumber(selectedVehicle.mileage ?? selectedVehicle.odometer);
    const mileageLabel = mileageValue != null ? `${mileageFormatter.format(mileageValue)} mi` : '—';
    const updatedTimestamp = selectedVehicle.updatedAt || selectedVehicle.timestamp || selectedVehicle.modifiedAt || selectedVehicle.date;
    const updatedDate = updatedTimestamp ? new Date(updatedTimestamp) : null;
    const updatedLabel = updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toLocaleString() : '—';
    const vinFull = selectedVehicle.vin ? String(selectedVehicle.vin).toUpperCase() : '—';
    const vehicleTitleParts = [selectedVehicle.year, selectedVehicle.make, selectedVehicle.model].filter(Boolean);
    const vehicleTitle = vehicleTitleParts.length ? vehicleTitleParts.join(' ') : 'Vehicle Details';
  const vehicleIdentifier = getVehicleIdentifier(selectedVehicle);
  const isEditing = Boolean(editVehicleData && vehicleIdentifier && getVehicleIdentifier(editVehicleData) === vehicleIdentifier);
  const editingSnapshot = isEditing ? editVehicleData : null;
  const editingStatusValue = normalizeStatus(editingSnapshot?.status ?? selectedVehicle.status ?? 'available');

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur"
        onClick={() => setSelectedVehicle(null)}
      >
        <div
          className="w-full max-w-4xl overflow-hidden rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface)] shadow-[0_40px_110px_rgba(5,6,8,0.75)]"
          role="dialog"
          aria-modal="true"
          aria-label="Vehicle detail"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-[color:var(--x-border)] bg-black/40 px-8 py-6">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Vehicle #{selectedVehicle.stockNumber || '—'}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{vehicleTitle}</h2>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">VIN {vinFull}</p>
            </div>
            <button
              onClick={() => setSelectedVehicle(null)}
              className="rounded-full border border-[color:var(--x-border)] bg-black/40 p-2 text-[color:var(--x-text-secondary)] transition hover:border-[color:var(--x-primary)] hover:text-[color:var(--x-primary)]"
              aria-label="Close vehicle details"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid gap-8 px-8 py-6 md:grid-cols-[1.7fr_minmax(240px,1fr)]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-[color:var(--x-border)] bg-black/30 px-6 py-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">Vehicle Overview</h3>
                <dl className="mt-5 grid grid-cols-1 gap-4 text-sm text-[color:var(--x-text-secondary)] sm:grid-cols-2">
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.22em]">Trim</dt>
                    <dd className="mt-1 text-base font-semibold text-white">{selectedVehicle.trim || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.22em]">Exterior Color</dt>
                    <dd className="mt-1 text-base font-semibold text-white">{selectedVehicle.color || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.22em]">Location</dt>
                    <dd className="mt-1 text-base font-semibold text-white">{selectedVehicle.location || selectedVehicle.lot || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.22em]">Detail Package</dt>
                    <dd className="mt-1 text-base font-semibold text-white">{selectedVehicle.detailPackage || selectedVehicle.package || 'Not Assigned'}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-[color:var(--x-border)] bg-black/30 px-6 py-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">Notes & Instructions</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--x-text-secondary)]">
                  {selectedVehicle.notes || selectedVehicle.comments || 'No notes have been captured for this vehicle yet.'}
                </p>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-[color:var(--x-border)] bg-gradient-to-b from-black/40 to-black/10 px-5 py-5">
                <div className="flex items-center justify-between">
                  <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--x-text-secondary)]">Status</span>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold ${getStatusColor(selectedVehicle.status)}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    {formatStatusLabel(selectedVehicle.status)}
                  </span>
                </div>
                <dl className="mt-6 space-y-4 text-sm text-[color:var(--x-text-secondary)]">
                  <div className="flex items-baseline justify-between">
                    <dt className="uppercase tracking-[0.18em]">Price</dt>
                    <dd className="text-base font-semibold text-white">{priceLabel}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="uppercase tracking-[0.18em]">Mileage</dt>
                    <dd className="text-base font-semibold text-white">{mileageLabel}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="uppercase tracking-[0.18em]">Last Update</dt>
                    <dd className="text-xs font-semibold text-white/80">{updatedLabel}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-[color:var(--x-border)] bg-black/30 px-5 py-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">Quick Actions</h3>
                {isEditing ? (
                  <form onSubmit={handleVehicleSave} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Vehicle Status</label>
                      <select
                        value={editingStatusValue}
                        onChange={(event) => handleEditFieldChange('status', event.target.value)}
                        disabled={isSavingVehicle}
                        className="mt-2 w-full rounded-xl border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-sm text-white transition focus:border-[color:var(--x-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Price</label>
                        <input
                          type="text"
                          value={editingSnapshot?.price ?? ''}
                          onChange={(event) => handleEditFieldChange('price', event.target.value)}
                          disabled={isSavingVehicle}
                          className="mt-2 w-full rounded-xl border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="$42,500"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Mileage / Odometer</label>
                        <input
                          type="text"
                          value={editingSnapshot?.odometer ?? ''}
                          onChange={(event) => handleEditFieldChange('odometer', event.target.value)}
                          disabled={isSavingVehicle}
                          className="mt-2 w-full rounded-xl border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="48,200"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Exterior Color</label>
                        <input
                          type="text"
                          value={editingSnapshot?.color ?? ''}
                          onChange={(event) => handleEditFieldChange('color', event.target.value)}
                          disabled={isSavingVehicle}
                          className="mt-2 w-full rounded-xl border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Carbon Black Metallic"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Lot Location</label>
                        <input
                          type="text"
                          value={editingSnapshot?.location ?? ''}
                          onChange={(event) => handleEditFieldChange('location', event.target.value)}
                          disabled={isSavingVehicle}
                          className="mt-2 w-full rounded-xl border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Front Line"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Detail Package</label>
                        <input
                          type="text"
                          value={editingSnapshot?.detailPackage ?? ''}
                          onChange={(event) => handleEditFieldChange('detailPackage', event.target.value)}
                          disabled={isSavingVehicle}
                          className="mt-2 w-full rounded-xl border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Premium Exterior"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Tags</label>
                        <input
                          type="text"
                          value={editingSnapshot?.tags ?? ''}
                          onChange={(event) => handleEditFieldChange('tags', event.target.value)}
                          disabled={isSavingVehicle}
                          className="mt-2 w-full rounded-xl border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="no-title,priority"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Internal Notes</label>
                        <textarea
                          value={editingSnapshot?.notes ?? ''}
                          onChange={(event) => handleEditFieldChange('notes', event.target.value)}
                          disabled={isSavingVehicle}
                          className="mt-2 h-24 w-full resize-none rounded-xl border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Document anything the team should know"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={isSavingVehicle}
                        className="rounded-full bg-gradient-to-r from-[color:var(--x-primary)] to-[color:var(--x-primary-soft)] px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-lg shadow-[rgba(5,127,245,0.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingVehicle ? 'Saving Changes…' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditVehicleData(null)}
                        disabled={isSavingVehicle}
                        className="rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:border-[color:var(--x-primary)] hover:text-[color:var(--x-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => handleCreateJobClick(selectedVehicle)}
                      disabled={jobLoadingId && vehicleIdentifier && jobLoadingId === vehicleIdentifier}
                      className="w-full rounded-full bg-gradient-to-r from-[color:var(--x-primary)] to-[color:var(--x-primary-soft)] px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-lg shadow-[rgba(5,127,245,0.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {jobLoadingId && vehicleIdentifier && jobLoadingId === vehicleIdentifier ? 'Creating Job…' : 'Create Job From Vehicle'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditVehicleClick(selectedVehicle)}
                      className="w-full rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:border-[color:var(--x-primary)] hover:text-[color:var(--x-primary)]"
                    >
                      Edit Vehicle Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintVehicle(selectedVehicle)}
                      className="w-full rounded-full border border-[color:var(--x-border)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--x-text-secondary)] transition hover:border-[color:var(--x-primary)] hover:text-[color:var(--x-primary)]"
                    >
                      Print Spec Sheet
                    </button>
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0F172A', color: '#F1F5F9' }}>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-gray-800 p-6 rounded-lg">
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2 mb-4"></div>
                  <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0F172A', color: '#F1F5F9' }}>
        <div className="p-6">
          <div className="bg-red-900 border border-red-700 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-red-200">Inventory Load Error</h3>
            </div>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F172A', color: '#F1F5F9' }}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.24em] text-[color:var(--x-text-secondary)]">Operations Suite</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Vehicle Inventory</h1>
            <p className="mt-2 text-sm text-[color:var(--x-text-secondary)]">Search, prioritize, and action every vehicle in a single view.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">
              {filteredAndSortedVehicles.length} Active Records
            </div>
            <div className="rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">
              {Math.max(vehicles.length - filteredAndSortedVehicles.length, 0)} Hidden
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-8 rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface)]/90 p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Search Vehicles</label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--x-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by VIN, stock #, make, model..."
                  className="w-full rounded-full border border-[color:var(--x-border)] bg-black/40 py-3 pl-12 pr-6 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-full border border-[color:var(--x-border)] bg-black/40 py-3 px-4 text-sm text-white transition focus:border-[color:var(--x-primary)] focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="in-service">In Service</option>
                <option value="maintenance">Maintenance</option>
                <option value="sold">Sold</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">Sort By</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="w-full rounded-full border border-[color:var(--x-border)] bg-black/40 py-3 px-4 text-sm text-white transition focus:border-[color:var(--x-primary)] focus:outline-none"
              >
                <option value="updatedAt-desc">Recently Updated</option>
                <option value="year-desc">Year (Newest)</option>
                <option value="year-asc">Year (Oldest)</option>
                <option value="make-asc">Make (A-Z)</option>
                <option value="make-desc">Make (Z-A)</option>
                <option value="stockNumber-asc">Stock Number</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-5 flex flex-col gap-4 border-t border-[color:var(--x-border)] pt-5 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-[color:var(--x-text-secondary)]">
              Showing <span className="font-semibold text-white">{filteredAndSortedVehicles.length}</span> of <span className="font-semibold text-white">{vehicles.length}</span> total vehicles
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--x-primary)] to-[color:var(--x-primary-soft)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-lg shadow-[rgba(5,127,245,0.25)] transition hover:opacity-90"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Vehicle
            </button>
          </div>
        </div>
  {/* Vehicle Table */}
        <div className="rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface)]/92 shadow-[0_32px_70px_rgba(5,6,8,0.65)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--x-border)]">
              <thead className="bg-black/40">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--x-text-secondary)]">Vehicle</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--x-text-secondary)]">VIN / Stock</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--x-text-secondary)]">Status</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--x-text-secondary)]">Details</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--x-text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--x-border)]">
                {filteredAndSortedVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-[color:var(--x-text-secondary)]">
                      {searchTerm || statusFilter !== 'all'
                        ? 'No vehicles match the current search or filters.'
                        : 'Inventory is empty. Add vehicles to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedVehicles.map((vehicle, index) => {
                    const vehicleId = getVehicleIdentifier(vehicle) || `vehicle-${index}`;
                    const statusLabel = formatStatusLabel(vehicle.status);
                    const priceValue = asNumber(vehicle.price);
                    const mileageValue = asNumber(vehicle.mileage ?? vehicle.odometer);
                    const priceLabel = priceValue != null ? currencyFormatter.format(priceValue) : '—';
                    const mileageLabel = mileageValue != null ? `${mileageFormatter.format(mileageValue)} mi` : '—';
                    const updatedTimestamp = vehicle.updatedAt || vehicle.timestamp || vehicle.modifiedAt || vehicle.date;
                    const updatedDate = updatedTimestamp ? new Date(updatedTimestamp) : null;
                    const updatedLabel = updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toLocaleDateString() : '—';
                    const locationLabel = vehicle.location || vehicle.lot || 'Lot TBD';
                    const vinSuffix = vehicle.vin ? String(vehicle.vin).slice(-8).toUpperCase() : null;
                    const vehicleTitle = buildVehicleTitle(vehicle) || 'Vehicle TBD';
                    const isJobCreating = Boolean(jobLoadingId && vehicleId && jobLoadingId === vehicleId);
                    const editingTargetId = editVehicleData?.id || editVehicleData?._id || editVehicleData?.vin || editVehicleData?.stockNumber;
                    const isEditingRow = Boolean(editingTargetId && vehicleId && editingTargetId === vehicleId);

                    return (
                      <tr
                        key={vehicleId}
                        onClick={() => setSelectedVehicle(vehicle)}
                        className="cursor-pointer transition-colors hover:bg-[color:var(--x-surface-elevated)]/80"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-white">
                            {vehicleTitle}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--x-text-secondary)]">
                            {(vehicle.trim || 'Trim TBD')} • {(vehicle.color || 'Color TBD')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs text-[color:var(--x-text-secondary)]">
                            {vinSuffix ? `VIN • ${vinSuffix}` : 'VIN pending'}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--x-text-secondary)]">
                            Stock • {vehicle.stockNumber || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusColor(statusLabel)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            {statusLabel}
                          </span>
                          <div className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-[color:var(--x-text-secondary)]">
                            Updated {updatedLabel}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[color:var(--x-text-secondary)]">
                          <div className="flex flex-col gap-1">
                            <span>Price: <span className="text-white font-semibold">{priceLabel}</span></span>
                            <span>Mileage: <span className="text-white font-semibold">{mileageLabel}</span></span>
                            <span>Location: <span className="text-white font-semibold">{locationLabel}</span></span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleCreateJobClick(vehicle); }}
                              disabled={isJobCreating}
                              className="rounded-full bg-gradient-to-r from-[color:var(--x-primary)] to-[color:var(--x-primary-soft)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-[rgba(5,127,245,0.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isJobCreating ? 'Creating…' : 'Create Job'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleEditVehicleClick(vehicle); }}
                              className="rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-[color:var(--x-primary)] hover:text-[color:var(--x-primary)]"
                            >
                              {isEditingRow ? 'Editing…' : 'Edit Vehicle'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handlePrintVehicle(vehicle); }}
                              className="rounded-full border border-[color:var(--x-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--x-text-secondary)] transition hover:border-[color:var(--x-primary)] hover:text-[color:var(--x-primary)]"
                            >
                              Print Sheet
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {renderVehicleModal()}
    </div>
  );
};

export default EnterpriseInventory;