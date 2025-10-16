import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { v2Request } from '../utils/v2Client';
import { useToast } from './Toast';
import {
  ensureServiceTypeCatalog,
  DEFAULT_SERVICE_TYPES,
  formatExpectedMinutes
} from '../utils/serviceTypes';

const EnterpriseInventory = ({
  theme = 'dark',
  onCreateJob,
  onEditVehicle,
  onPrintVehicle,
  currentUser,
  onVehicleUpdated,
  serviceTypes = DEFAULT_SERVICE_TYPES
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
  const [viewDensity, setViewDensity] = useState('cozy');
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('');
  const toast = useToast();

  const serviceCatalog = useMemo(
    () => ensureServiceTypeCatalog(serviceTypes || DEFAULT_SERVICE_TYPES),
    [serviceTypes]
  );
  const activeServiceTypes = useMemo(
    () => serviceCatalog.filter((type) => type.isActive !== false),
    [serviceCatalog]
  );
  const selectedServiceType = useMemo(() => {
    if (!activeServiceTypes.length) {
      return null;
    }
    const match = activeServiceTypes.find((type) => type.id === selectedServiceTypeId);
    return match || activeServiceTypes[0];
  }, [activeServiceTypes, selectedServiceTypeId]);

  useEffect(() => {
    if (!activeServiceTypes.length) {
      setSelectedServiceTypeId('');
      return;
    }
    setSelectedServiceTypeId((prev) => {
      if (prev && activeServiceTypes.some((type) => type.id === prev)) {
        return prev;
      }
      return activeServiceTypes[0].id;
    });
  }, [activeServiceTypes]);

  const statusOptions = useMemo(() => ([
    { value: 'all', label: 'All Status' },
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
    if (!vehicle) {
      return null;
    }
    return vehicle._id || vehicle.id || vehicle.vin || vehicle.stockNumber || null;
  };

  const getArrivalTimestamp = (vehicle = {}) =>
    vehicle.arrivalDate || vehicle.acquiredAt || vehicle.checkInDate || vehicle.createdAt || vehicle.date || vehicle.updatedAt;

  const calculateDaysInInventory = useCallback((vehicle) => {
    const arrival = getArrivalTimestamp(vehicle);
    if (!arrival) {
      return null;
    }
    const arrivalDate = new Date(arrival);
    if (Number.isNaN(arrivalDate.getTime())) {
      return null;
    }
    const now = new Date();
    const diffMs = now.getTime() - arrivalDate.getTime();
    if (diffMs < 0) {
      return 0;
    }
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }, []);

  const normalizeStatus = (status) => {
    if (!status) {
      return '';
    }
    return status
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
  };

  const buildVehicleTitle = (vehicle) => {
    if (!vehicle) {
      return 'Vehicle';
    }
    const composed = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ').trim();
    if (composed) {
      return composed;
    }
    return vehicle.vehicle || 'Vehicle';
  };

  const formatStatusLabel = (status) => {
    if (!status) {
      return 'Unknown';
    }
    return status
      .toString()
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const sanitizePriceForPayload = (value) => {
    if (value == null) {
      return '';
    }
    const numeric = String(value).replace(/[^0-9.]/g, '');
    if (!numeric) {
      return '';
    }
    const parsed = Number(numeric);
    if (!Number.isFinite(parsed)) {
      return String(value).trim();
    }
    const rounded = Math.round(parsed);
    return `$${rounded.toLocaleString('en-US')}`;
  };

  const sanitizeOdometerForPayload = (value) => {
    if (value == null) {
      return '';
    }
    const numeric = String(value).replace(/[^0-9]/g, '');
    if (!numeric) {
      return '';
    }
    const parsed = Number(numeric);
    if (!Number.isFinite(parsed)) {
      return String(value).trim();
    }
    return parsed.toLocaleString('en-US');
  };

  const asNumber = (value) => {
    if (value == null) {
      return null;
    }
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        return value;
      }
      return null;
    }
    const cleaned = Number(String(value).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(cleaned)) {
      return cleaned;
    }
    return null;
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
        if (!isActive) {
          return;
        }

        if (Array.isArray(payload)) {
          setVehicles(payload);
        } else if (payload?.success && Array.isArray(payload.vehicles)) {
          setVehicles(payload.vehicles);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        if (!isActive) {
          return;
        }
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

      const matchesStatus =
        statusFilter === 'all' || normalizeStatus(vehicle.status) === statusFilter;

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

      if (aVal < bVal) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  }, [vehicles, searchTerm, statusFilter, sortBy, sortOrder]);

  const groupedVehicles = useMemo(() => {
    const groups = {
      available: [],
      'in-service': [],
      maintenance: [],
      sold: [],
      backlog: []
    };

    filteredAndSortedVehicles.forEach(vehicle => {
      const normalizedStatus = normalizeStatus(vehicle.status);
      if (groups[normalizedStatus]) {
        groups[normalizedStatus].push(vehicle);
      } else {
        groups.backlog.push(vehicle);
      }
    });

    return groups;
  }, [filteredAndSortedVehicles]);

  const boardColumns = useMemo(() => {
    const descriptors = [
      {
        key: 'available',
        label: 'Frontline Ready',
        helper: 'Ready for sale or pickup',
        accent: 'from-sky-500/20 via-sky-400/5 to-transparent',
        chipClass: 'border border-sky-400/40 bg-sky-500/10 text-sky-200'
      },
      {
        key: 'in-service',
        label: 'Currently In Service',
        helper: 'Active detail or wash jobs',
        accent: 'from-amber-500/20 via-amber-400/5 to-transparent',
        chipClass: 'border border-amber-400/40 bg-amber-500/10 text-amber-200'
      },
      {
        key: 'maintenance',
        label: 'Maintenance Hold',
        helper: 'Waiting on parts or QC',
        accent: 'from-rose-500/15 via-rose-400/5 to-transparent',
        chipClass: 'border border-rose-400/40 bg-rose-500/10 text-rose-200'
      },
      {
        key: 'sold',
        label: 'Sold & Delivered',
        helper: 'Awaiting paperwork or transport',
        accent: 'from-emerald-500/15 via-emerald-400/5 to-transparent',
        chipClass: 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
      },
      {
        key: 'backlog',
        label: 'Needs Categorization',
        helper: 'Missing status or onboarding',
        accent: 'from-slate-500/20 via-slate-400/5 to-transparent',
        chipClass: 'border border-slate-400/40 bg-slate-500/10 text-slate-200'
      }
    ];

    return descriptors.map(descriptor => ({
      ...descriptor,
      vehicles: groupedVehicles[descriptor.key] || []
    }));
  }, [groupedVehicles]);

  const totalInventoryValue = useMemo(() => filteredAndSortedVehicles.reduce((sum, vehicle) => {
    const numeric = asNumber(vehicle.price);
    if (!numeric) {
      return sum;
    }
    return sum + numeric;
  }, 0), [filteredAndSortedVehicles]);

  const averageDaysInInventory = useMemo(() => {
    const samples = filteredAndSortedVehicles
      .map(calculateDaysInInventory)
      .filter(value => value != null);
    if (!samples.length) {
      return null;
    }
    const total = samples.reduce((sum, value) => sum + value, 0);
    return Math.round(total / samples.length);
  }, [filteredAndSortedVehicles, calculateDaysInInventory]);

  const newArrivalsCount = useMemo(() => {
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return filteredAndSortedVehicles.filter(vehicle => {
      const arrival = getArrivalTimestamp(vehicle);
      if (!arrival) {
        return false;
      }
      const arrivalDate = new Date(arrival);
      if (Number.isNaN(arrivalDate.getTime())) {
        return false;
      }
      return now - arrivalDate.getTime() <= oneWeekMs;
    }).length;
  }, [filteredAndSortedVehicles]);

  const metricTiles = useMemo(() => ([
    {
      key: 'total',
      label: 'Vehicles In View',
      value: filteredAndSortedVehicles.length.toLocaleString(),
      description: `${vehicles.length.toLocaleString()} total records`
    },
    {
      key: 'value',
      label: 'Total Asking Value',
      value: totalInventoryValue ? currencyFormatter.format(totalInventoryValue) : '—',
      description: 'Active filter selection'
    },
    {
      key: 'frontline',
      label: 'Frontline Ready',
      value: groupedVehicles.available.length.toLocaleString(),
      description: `${newArrivalsCount} arrivals in last 7 days`
    },
    {
      key: 'aging',
      label: 'Avg Days In Inventory',
      value: averageDaysInInventory != null ? `${averageDaysInInventory}d` : '—',
      description: averageDaysInInventory != null ? 'Since arrival/check-in' : 'Arrival data missing'
    }
  ]), [
    filteredAndSortedVehicles.length,
    vehicles.length,
    totalInventoryValue,
    currencyFormatter,
    groupedVehicles.available.length,
    newArrivalsCount,
    averageDaysInInventory
  ]);

  const renderVehicleCard = (vehicle, columnKey, index = 0) => {
    const fallbackId = `vehicle-${columnKey}-${index}`;
    const vehicleId = getVehicleIdentifier(vehicle) || fallbackId;
    const vehicleTitle = buildVehicleTitle(vehicle);
    const vinSuffix = vehicle?.vin ? String(vehicle.vin).slice(-8).toUpperCase() : null;
    const statusLabel = formatStatusLabel(vehicle.status);
    const priceValue = asNumber(vehicle.price);
    const priceLabel = priceValue != null ? currencyFormatter.format(priceValue) : '—';
    const mileageValue = asNumber(vehicle.mileage ?? vehicle.odometer);
    const mileageLabel = mileageValue != null ? `${mileageFormatter.format(mileageValue)} mi` : '—';
    const locationLabel = vehicle.location || vehicle.lot || 'Lot TBD';
    const daysInInventory = calculateDaysInInventory(vehicle);
    const daysLabel = daysInInventory != null ? `${daysInInventory} day${daysInInventory === 1 ? '' : 's'}` : 'Untracked';
    const updatedTimestamp = vehicle.updatedAt || vehicle.timestamp || vehicle.modifiedAt || vehicle.date;
    let updatedLabel = '—';
    if (updatedTimestamp) {
      const updatedDate = new Date(updatedTimestamp);
      if (!Number.isNaN(updatedDate.getTime())) {
        updatedLabel = updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }
    const isJobCreating = Boolean(vehicleId && jobLoadingId === vehicleId);
    const editingTargetId = editVehicleData?.id || editVehicleData?._id || editVehicleData?.vin || editVehicleData?.stockNumber;
    const isEditing = Boolean(editingTargetId && vehicleId && editingTargetId === vehicleId);

    const paddingClass = viewDensity === 'compact' ? 'p-4' : 'p-6';
    const metaGapClass = viewDensity === 'compact' ? 'gap-3 text-[0.8rem]' : 'gap-4 text-sm';

    return (
      <article
        key={vehicleId}
        onClick={() => setSelectedVehicle(vehicle)}
        className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-[color:var(--x-border)] bg-black/35 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-1 hover:border-[color:var(--x-blue)] ${paddingClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--x-text-secondary)]">
              {vinSuffix ? `VIN • ${vinSuffix}` : 'VIN pending'}
            </p>
            <h4 className="text-lg font-semibold text-white sm:text-xl">{vehicleTitle}</h4>
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--x-text-secondary)]">Ask</p>
            <p className="text-xl font-semibold text-white">{priceLabel}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusColor(statusLabel)}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {statusLabel}
          </span>
          <span className="x-badge bg-black/20">{locationLabel}</span>
          <span className="x-badge bg-black/20">Age • {daysLabel}</span>
        </div>

        <div className={`mt-4 grid grid-cols-2 ${metaGapClass}`}>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[color:var(--x-text-secondary)]">Mileage</p>
            <p className="font-semibold text-white">{mileageLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[color:var(--x-text-secondary)]">Updated</p>
            <p className="font-semibold text-white">{updatedLabel}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--x-text-secondary)]">
            {vehicle.detailPackage ? `Package • ${vehicle.detailPackage}` : 'Package TBD'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${selectedServiceType ? 'border-[color:var(--x-border)] text-[color:var(--x-text-secondary)] bg-black/40' : 'border-red-500/60 text-red-200 bg-red-500/10'}`}
            >
              {selectedServiceType
                ? `${selectedServiceType.name} • ${formatExpectedMinutes(selectedServiceType.expectedMinutes)}`
                : 'No active services'}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCreateJobClick(vehicle);
              }}
              disabled={isJobCreating || !selectedServiceType}
              className="rounded-full bg-[color:var(--x-blue)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-[color:var(--x-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isJobCreating ? 'Creating…' : 'Launch Job'}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleEditVehicleClick(vehicle);
              }}
              className="rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-[color:var(--x-blue)] hover:text-[color:var(--x-blue)]"
            >
              {isEditing ? 'Editing…' : 'Open Sheet'}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handlePrintVehicle(vehicle);
              }}
              className="rounded-full border border-[color:var(--x-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--x-text-secondary)] transition hover:border-[color:var(--x-blue)] hover:text-[color:var(--x-blue)]"
            >
              Print Spec
            </button>
          </div>
        </div>
      </article>
    );
  };

  // Get status color
  const getStatusColor = (status) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
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
  const handleCreateJobClick = async (vehicle) => {
    if (!vehicle) {
      return;
    }
    if (!selectedServiceType) {
      toast.error('No active service types are configured. Publish the catalog in Settings.');
      return;
    }
    const vehicleId = getVehicleIdentifier(vehicle);
    if (vehicleId && jobLoadingId === vehicleId) {
      return;
    }

    try {
      if (vehicleId) {
        setJobLoadingId(vehicleId);
      }

      if (typeof onCreateJob === 'function') {
        await onCreateJob(vehicle, {
          selectedServiceType,
          serviceCatalog,
          activeServiceTypes
        });
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
        serviceType: selectedServiceType?.name || 'Cleanup',
        expectedDuration: selectedServiceType?.expectedMinutes || 60,
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
      toast.success(`Created ${selectedServiceType.name} job for ${buildVehicleTitle(vehicle)}.`);
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Failed to create job';
      toast.error(message);
      console.error('Create job from inventory failed:', error);
    } finally {
      setJobLoadingId(null);
    }
  };

  const beginEditingVehicle = (vehicle) => {
    if (!vehicle) {
      return;
    }
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

    const priceNumeric = asNumber(vehicle?.price);
    const mileageNumeric = asNumber(vehicle?.mileage ?? vehicle?.odometer);

    const rows = [
      ['Vehicle', `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim()],
      ['Trim', vehicle.trim || '—'],
      ['Stock #', vehicle.stockNumber || '—'],
      ['VIN', vehicle.vin || '—'],
      ['Status', vehicle.status || 'Unknown'],
      ['Color', vehicle.color || '—'],
      ['Location', vehicle.location || vehicle.lot || '—'],
      ['Mileage', mileageNumeric != null ? `${mileageFormatter.format(mileageNumeric)} mi` : '—'],
      ['Price', priceNumeric != null ? currencyFormatter.format(priceNumeric) : '—'],
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
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleVehicleSave = async (event) => {
    event?.preventDefault();
    if (!selectedVehicle || !editVehicleData) {
      return;
    }

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
    <div className="min-h-screen bg-[#05070a] text-[color:var(--x-text-primary)]">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-10 px-4 pb-16 pt-8 sm:px-6 lg:px-12">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[0.65rem] uppercase tracking-[0.24em] text-[color:var(--x-text-secondary)]">Operations Suite</p>
            <h1 className="text-4xl font-semibold text-white">Enterprise Inventory Command</h1>
            <p className="max-w-xl text-sm text-[color:var(--x-text-secondary)]">Monitor lifecycle, launch work orders, and keep frontline units customer-ready from one desktop view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">
              {filteredAndSortedVehicles.length} In Frame
            </div>
            <div className="rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">
              {Math.max(vehicles.length - filteredAndSortedVehicles.length, 0)} Filtered Out
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[color:var(--x-border)] bg-black/40 px-2 py-1">
              <button
                type="button"
                onClick={() => setViewDensity('cozy')}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] transition ${viewDensity === 'cozy' ? 'bg-[color:var(--x-blue)] text-black' : 'text-[color:var(--x-text-secondary)] hover:text-white'}`}
              >
                Cozy
              </button>
              <button
                type="button"
                onClick={() => setViewDensity('compact')}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] transition ${viewDensity === 'compact' ? 'bg-[color:var(--x-blue)] text-black' : 'text-[color:var(--x-text-secondary)] hover:text-white'}`}
              >
                Dense
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">
                Launch Service
              </label>
              <select
                value={selectedServiceTypeId}
                onChange={(event) => setSelectedServiceTypeId(event.target.value)}
                disabled={!activeServiceTypes.length}
                className="min-w-[220px] rounded-full border border-[color:var(--x-border)] bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition focus:border-[color:var(--x-blue)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeServiceTypes.length === 0 && (
                  <option value="">No active services</option>
                )}
                {activeServiceTypes.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} • {formatExpectedMinutes(service.expectedMinutes)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface)]/80 p-6 shadow-[0_40px_100px_rgba(5,7,10,0.6)] lg:p-8">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label htmlFor="inventory-search" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">
                Search Fleet
              </label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--x-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="inventory-search"
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by VIN, stock, make, model, color"
                  className="w-full rounded-full border border-[color:var(--x-border)] bg-black/35 py-3 pl-12 pr-6 text-sm text-white placeholder-[color:var(--x-text-secondary)] transition focus:border-[color:var(--x-blue)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="inventory-status-filter" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">
                Filter Status
              </label>
              <select
                id="inventory-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-full border border-[color:var(--x-border)] bg-black/35 py-3 px-4 text-sm text-white transition focus:border-[color:var(--x-blue)] focus:outline-none"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inventory-sort-order" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">
                Sort Sequence
              </label>
              <select
                id="inventory-sort-order"
                value={`${sortBy}-${sortOrder}`}
                onChange={(event) => {
                  const [field, order] = event.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="w-full rounded-full border border-[color:var(--x-border)] bg-black/35 py-3 px-4 text-sm text-white transition focus:border-[color:var(--x-blue)] focus:outline-none"
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

          <div className="mt-6 flex flex-col gap-4 border-t border-[color:var(--x-border)] pt-5 lg:flex-row lg:items-center lg:justify-between">
            <span className="text-sm text-[color:var(--x-text-secondary)]">
              Showing <span className="font-semibold text-white">{filteredAndSortedVehicles.length}</span> of <span className="font-semibold text-white">{vehicles.length}</span> vehicles
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[color:var(--x-border)] bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--x-text-secondary)]">
                {newArrivalsCount} arrivals in 7 days
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--x-blue)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[color:var(--x-blue-hover)]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Vehicle
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricTiles.map(tile => (
            <article key={tile.key} className="x-card x-card--compact x-fade-in bg-black/40">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">{tile.label}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{tile.value}</p>
              <p className="text-xs text-[color:var(--x-text-secondary)]">{tile.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface)]/70 p-6 lg:p-8">
          <div className="flex snap-x gap-5 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible">
            {boardColumns.map(column => (
              <div
                key={column.key}
                className="flex min-w-[280px] flex-1 flex-col gap-4 rounded-2xl border border-[color:var(--x-border)] bg-black/30 p-4 backdrop-blur-sm lg:min-w-0"
              >
                <header className="space-y-2 rounded-xl bg-gradient-to-br from-transparent via-transparent to-black/20 p-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white">{column.label}</h3>
                      <p className="text-xs text-[color:var(--x-text-secondary)]">{column.helper}</p>
                    </div>
                    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${column.chipClass}`}>
                      {column.vehicles.length}
                    </span>
                  </div>
                </header>

                <div className="flex flex-col gap-4">
                  {column.vehicles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[color:var(--x-border)] bg-black/20 p-6 text-center text-xs text-[color:var(--x-text-secondary)]">
                      Nothing here yet. Drop a vehicle into this lane when ready.
                    </div>
                  ) : (
                    column.vehicles.map((vehicle, index) => renderVehicleCard(vehicle, column.key, index))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {renderVehicleModal()}
    </div>
  );
};

export default EnterpriseInventory;
