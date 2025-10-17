import React, { useState, useEffect, useMemo } from 'react';
import VinScanner from '../../components/VinScanner';
import { useToast } from '../../components/Toast';
import { V2 } from '../../utils/v2Client';
import DateUtils from '../../utils/dateUtils';
import {
  ensureServiceTypeCatalog,
  DEFAULT_SERVICE_TYPES,
  formatExpectedMinutes
} from '../../utils/serviceTypes';

function DetailerNewJob({ user, onSearch, searchResults, isSearching, searchTerm, setSearchTerm, showScanner, setShowScanner, onScanSuccess, hasSearched, onJobCreated, serviceTypesCatalog }) {
  const toast = useToast();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [salesPerson, setSalesPerson] = useState('');
  const [salespersons, setSalespersons] = useState([]);
  const [showServiceCatalog, setShowServiceCatalog] = useState(false);

  const serviceCatalog = useMemo(
    () => ensureServiceTypeCatalog(serviceTypesCatalog || DEFAULT_SERVICE_TYPES),
    [serviceTypesCatalog]
  );
  const activeServiceTypes = useMemo(
    () => serviceCatalog.filter((type) => type.isActive !== false),
    [serviceCatalog]
  );
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState(() => activeServiceTypes[0]?.id || serviceCatalog[0]?.id || '');
  const selectedServiceType = useMemo(() => {
    if (activeServiceTypes.length === 0) {
      return null;
    }
    return activeServiceTypes.find((type) => type.id === selectedServiceTypeId) || activeServiceTypes[0];
  }, [activeServiceTypes, selectedServiceTypeId]);

  // Fetch salespersons
  useEffect(() => {
    const fetchSalespersons = async () => {
      try {
        const response = await V2.get('/users');
        const salespeople = response.data.filter(user => user.role === 'salesperson');
        setSalespersons(salespeople);
      } catch (error) {
        console.error('Failed to fetch salespersons:', error);
      }
    };
    fetchSalespersons();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  useEffect(() => {
    setSelectedServiceTypeId((prev) => {
      if (activeServiceTypes.some((type) => type.id === prev)) {
        return prev;
      }
      return activeServiceTypes[0]?.id || '';
    });
  }, [activeServiceTypes]);

  // Auto-select when exactly one result
  useEffect(() => {
    if (searchResults && searchResults.length === 1) {
      setSelectedVehicle(searchResults[0]);
    }
  }, [searchResults]);

  const handleCreateJob = async () => {
    // Enhanced validation
    if (!selectedVehicle) {
      toast.error('Please select a vehicle first');
      return;
    }

    if (!selectedServiceType) {
      toast.error('No active service types are configured');
      return;
    }

    if (!selectedVehicle.vin || selectedVehicle.vin.length < 10) {
      toast.error('Invalid VIN number');
      return;
    }

    try {
      toast.info('Creating job...');
      const now = new Date();
      const resolvedServiceType = selectedServiceType?.name || 'Cleanup';
      const resolvedExpectedMinutes = selectedServiceType?.expectedMinutes || 60;
      const newJob = {
        technicianId: user.id,
        technicianName: user.name,
        vin: selectedVehicle.vin,
        stockNumber: selectedVehicle.stockNumber,
        vehicleDescription: `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`,
        serviceType: resolvedServiceType,
        expectedDuration: resolvedExpectedMinutes,
        salesPerson: salesPerson.trim() || '',
        assignedTechnicianIds: [user.id],
        status: 'In Progress',
        date: DateUtils.getLocalDateString(now),
        startTime: now.toISOString(),
        startedAt: now.toISOString(),
        createdAt: now.toISOString(),
        timestamp: now.toISOString(),
        // Vehicle details
        year: selectedVehicle.year || '',
        make: selectedVehicle.make || '',
        model: selectedVehicle.model || '',
        vehicleColor: selectedVehicle.color || '',
        priority: 'Normal'
      };

      await V2.post('/jobs', newJob);
      toast.success('Job started successfully!');
      setSelectedVehicle(null);
      setSearchTerm('');
      setSalesPerson('');
      if (activeServiceTypes.length > 0) {
        setSelectedServiceTypeId(activeServiceTypes[0].id);
      }

      // Refresh job data and navigate to dashboard
      if (onJobCreated) {
        await onJobCreated();
      }
    } catch (err) {
      toast.error('Failed to start job: ' + (err.response?.data?.error || err.message));
    }
  }
  const hasVehicleSelection = Boolean(selectedVehicle);
  const hasActiveServiceTypes = activeServiceTypes.length > 0;
  const estimatedDurationLabel = selectedServiceType ? formatExpectedMinutes(selectedServiceType.expectedMinutes) : '—';
  const serviceDescription = selectedServiceType?.description || 'Choose a package that matches the vehicle condition or customer promise.';

  return (
    <div className="space-y-8">
      <header className="bg-gradient-to-r from-blue-500/10 via-blue-600/5 to-transparent border border-blue-600/20 rounded-3xl px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg shadow-blue-500/5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-300 mb-2">Launch New Job</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white">Bring the next vehicle online in under a minute</h2>
          <p className="text-sm text-blue-100/80 mt-2">
            Scan, search, and configure without leaving this screen. We’ll preload service expectations, timers, and sales notifications.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
          {[{
            title: 'Scan & Identify',
            active: !hasVehicleSelection,
            completed: hasVehicleSelection,
            icon: (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h4M17 7h4M3 17h4M17 17h4" />
              </svg>
            )
          }, {
            title: 'Select Package',
            active: hasVehicleSelection && !selectedServiceType,
            completed: Boolean(selectedServiceType),
            icon: (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4" />
              </svg>
            )
          }, {
            title: 'Launch Timer',
            active: Boolean(selectedServiceType),
            completed: false,
            icon: (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" />
              </svg>
            )
          }].map((step, index) => (
            <div
              key={step.title}
              className={`rounded-2xl px-4 py-3 border flex flex-col gap-2 transition ${
                step.completed
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                  : step.active
                    ? 'border-blue-400/60 bg-blue-500/10 text-blue-100'
                    : 'border-gray-700 bg-black text-gray-500'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
                {step.icon}
                <span>Step {index + 1}</span>
              </div>
              <p className="text-sm font-medium leading-tight">{step.title}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_minmax(360px,1fr)] gap-6">
        <div className="space-y-6">
          <section className="bg-black border border-gray-800/80 rounded-3xl shadow-xl shadow-black/20 overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 p-6 space-y-5">
                <h3 className="text-white text-lg font-semibold flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-500/10 border border-blue-500/40 text-blue-300 text-sm font-semibold">A</span>
                  Scan VIN or search inventory
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Use the integrated scanner for instant VIN recognition or type the last 6 to surface stock vehicles. We’ll auto-fill vehicle data when you select a match.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="group bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-500 text-white rounded-2xl px-5 py-4 flex items-center justify-between transition transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/20"
                  >
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/80">Scanner</p>
                      <p className="mt-1 text-lg font-semibold">Launch VIN capture</p>
                    </div>
                    <svg className="h-5 w-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10v10H7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h1m16 0h1M3 17h1m16 0h1" />
                    </svg>
                  </button>
                  <form onSubmit={handleSearchSubmit} className="bg-black border border-gray-800 rounded-2xl px-5 py-4 flex flex-col gap-3 shadow-inner">
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-gray-500">Search Inventory</label>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="VIN, stock number, make, or model"
                        className="mt-2 w-full bg-black border border-gray-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isSearching || !searchTerm.trim()}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 font-semibold py-2.5 rounded-xl transition disabled:text-gray-500 disabled:bg-gray-800"
                      >
                        {isSearching ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Searching
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Find vehicle
                          </>
                        )}
                      </button>
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {hasSearched && searchResults.length === 0 && !isSearching && (
                  <div className="bg-red-500/10 border border-red-500/40 rounded-2xl px-4 py-3 text-sm text-red-200">
                    No vehicles found. Double check the VIN or stock number and try again.
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">Matches</h4>
                      <span className="text-xs text-blue-300">Showing {searchResults.length}</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                      {searchResults.map((vehicle) => {
                        const isSelected = selectedVehicle?.vin === vehicle.vin;
                        return (
                          <button
                            key={vehicle.vin}
                            type="button"
                            onClick={() => setSelectedVehicle(vehicle)}
                            className={`w-full text-left rounded-2xl border px-4 py-4 transition flex items-start gap-3 ${
                              isSelected ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10' : 'border-gray-800 bg-black hover:border-blue-500/60'
                            }`}
                          >
                            <div className="flex-1">
                              <p className="text-white font-semibold text-sm">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                              <p className="text-xs text-gray-500 mt-1">VIN • {vehicle.vin}</p>
                              <p className="text-xs text-gray-500">Stock • {vehicle.stockNumber || 'N/A'}</p>
                              {vehicle.color && <p className="text-xs text-gray-500">Color • {vehicle.color}</p>}
                            </div>
                            <div className={`h-8 w-8 flex items-center justify-center rounded-full border ${
                              isSelected ? 'border-blue-300 bg-blue-500/20 text-blue-200' : 'border-gray-700 text-gray-500'
                            }`}>
                              {isSelected ? (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-black border border-gray-800/80 rounded-3xl p-6 space-y-5 shadow-xl shadow-black/15">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Service Packages</p>
                <h3 className="text-white text-lg font-semibold">Select the right level of work</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowServiceCatalog((prev) => !prev)}
                className="text-xs font-medium text-blue-400 hover:text-blue-200"
              >
                {showServiceCatalog ? 'Hide catalog' : 'View catalog'}
              </button>
            </div>

            {!hasActiveServiceTypes ? (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl px-4 py-3 text-sm text-amber-200">
                No active service types are available. Ask a manager to enable offerings in Settings.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeServiceTypes.map((service) => {
                  const isSelected = selectedServiceTypeId === service.id;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedServiceTypeId(service.id)}
                      className={`text-left rounded-3xl border px-5 py-4 transition transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/60 ${
                        isSelected ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10' : 'border-gray-800 bg-black hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-sm font-semibold ${isSelected ? 'text-emerald-200' : 'text-white'}`}>{service.name}</p>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isSelected ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                          {formatExpectedMinutes(service.expectedMinutes)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-normal mt-2">
                        {service.description || 'Preconfigured scope with expected timing and QC checkpoints.'}
                      </p>
                      {service.expectedMinutes > 90 ? (
                        <div className="inline-flex items-center gap-1 text-[10px] text-amber-300 mt-3 px-2.5 py-1 rounded-full border border-amber-400/50 bg-amber-400/10">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Extended duration
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {showServiceCatalog && (
              <div className="bg-black border border-gray-800 rounded-2xl overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-900 text-[10px] uppercase tracking-[0.2em] text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900">
                    {serviceCatalog.map((service) => (
                      <tr key={service.id} className="hover:bg-gray-900/60">
                        <td className="px-4 py-3 text-white font-medium">{service.name}</td>
                        <td className="px-4 py-3 text-gray-400">{formatExpectedMinutes(service.expectedMinutes)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${service.isActive !== false ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                            {service.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="bg-black border border-gray-800 rounded-3xl p-6 space-y-6 shadow-2xl shadow-black/25">
          <h3 className="text-white font-semibold text-lg">Job launch summary</h3>
          {!hasVehicleSelection ? (
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-6 text-sm text-gray-500">
              Select or scan a vehicle to unlock the launch summary.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-transparent border border-blue-600/30 rounded-2xl px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-blue-200 mb-2">Vehicle</p>
                <p className="text-white text-xl font-semibold leading-tight">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-400">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">VIN</p>
                    <p className="font-mono text-sm text-white">{selectedVehicle.vin}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Stock</p>
                    <p className="text-white text-sm">{selectedVehicle.stockNumber || 'N/A'}</p>
                  </div>
                  {selectedVehicle.color ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Color</p>
                      <p className="text-white text-sm">{selectedVehicle.color}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Service</p>
                  <p className="text-white font-semibold text-base mt-1">{selectedServiceType?.name || 'Select a service'}</p>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">{serviceDescription}</p>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Estimated Duration</p>
                  <p className="text-white font-semibold text-base mt-1">{estimatedDurationLabel}</p>
                  <p className="text-xs text-gray-500 mt-2">Timer will start at launch and subtract any pauses automatically.</p>
                </div>
              </div>

              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Salesperson (optional)</p>
                </div>
                <select
                  value={salesPerson}
                  onChange={(e) => setSalesPerson(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select salesperson...</option>
                  {salespersons.map((person) => (
                    <option key={person.id || person._id} value={person.name}>
                      {person.name}
                    </option>
                  ))}
                </select>
                {salesPerson && (
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>
                      Assigned to <span className="text-blue-300">{salesPerson}</span>
                    </span>
                    <button type="button" onClick={() => setSalesPerson('')} className="text-blue-400 hover:text-blue-200">
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateJob}
                disabled={!selectedServiceType || !hasActiveServiceTypes}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 font-semibold transition-all shadow-lg disabled:cursor-not-allowed disabled:bg-gray-900 disabled:text-gray-600 ${
                  hasVehicleSelection && selectedServiceType ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-black' : 'bg-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                {hasVehicleSelection ? 'Launch Job' : 'Select a vehicle to launch'}
              </button>
            </div>
          )}
        </aside>
      </div>

      {showScanner && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black rounded-xl p-6 w-full max-w-md border border-gray-800 shadow-lg">
            <h3 className="text-white font-semibold text-lg mb-4">Scan VIN Barcode</h3>
            <VinScanner onSuccess={onScanSuccess} onClose={() => setShowScanner(false)} />
            <button
              onClick={() => setShowScanner(false)}
              className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DetailerNewJob;
