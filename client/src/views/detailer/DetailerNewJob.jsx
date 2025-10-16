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
  };

  return (
    <div className="space-y-6">
      {/* Scan Option */}
      <div className="bg-black rounded-xl p-6 border border-gray-800 shadow-sm">
        <h3 className="text-white font-semibold text-lg mb-4">Scan VIN Barcode</h3>
        <button
          onClick={() => setShowScanner(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <span>Scan VIN</span>
        </button>
      </div>

      {/* Search Option */}
      <div className="bg-black rounded-xl p-6 border border-gray-800 shadow-sm">
        <h3 className="text-white font-semibold text-lg mb-4">Search Vehicle</h3>
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter VIN or Stock Number"
            className="w-full bg-black text-white placeholder-gray-500 border border-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSearching || !searchTerm.trim()}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-500"
            >
              {isSearching ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </span>
              ) : 'Search'}
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); }}
                className="px-4 py-3 rounded-lg border border-gray-700 text-gray-700 bg-black hover:bg-gray-100"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Search Results */}
        {hasSearched && searchResults.length === 0 && !isSearching && (
          <p className="mt-4 text-gray-600">No vehicles found. Check VIN/Stock and try again.</p>
        )}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-white font-medium">Search Results</h4>
            {searchResults.map((vehicle, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedVehicle?.vin === vehicle.vin
                    ? 'bg-blue-100 border border-blue-300'
                    : 'bg-black hover:bg-gray-900 border border-gray-800'
                }`}
                onClick={() => setSelectedVehicle(vehicle)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-white font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-gray-600 text-sm">VIN: <span className="font-mono">{vehicle.vin}</span></p>
                      <p className="text-gray-600 text-sm">Stock: {vehicle.stockNumber}</p>
                    </div>
                  </div>
                  {vehicle.color && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                      {vehicle.color}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Vehicle & Job Creation */}
        {selectedVehicle && (
          <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="text-blue-800 font-semibold mb-3">Selected Vehicle</h4>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-white text-lg font-bold">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-blue-700 text-sm">Stock: {selectedVehicle.stockNumber}</p>
                  <p className="text-blue-700 text-sm">VIN: <span className="font-mono">{selectedVehicle.vin}</span></p>
                </div>
              </div>
              {selectedVehicle.color && (
                <span className="px-3 py-1 bg-blue-200 text-blue-900 text-sm rounded-full font-semibold">
                  {selectedVehicle.color}
                </span>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-blue-800 font-medium mb-2">Service Type</label>
              <select
                value={selectedServiceTypeId}
                onChange={(e) => setSelectedServiceTypeId(e.target.value)}
                className="w-full bg-black text-white border border-gray-700 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {activeServiceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} • {formatExpectedMinutes(type.expectedMinutes)}
                  </option>
                ))}
              </select>
              {selectedServiceType && (
                <p className="mt-2 text-xs text-blue-200">
                  Target completion: {formatExpectedMinutes(selectedServiceType.expectedMinutes)}
                </p>
              )}
              {activeServiceTypes.length === 0 && (
                <p className="mt-2 text-xs text-red-300">
                  No active service types are configured. Ask a manager to publish the service catalog.
                </p>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-blue-800 font-medium mb-2">Sales Person (Optional)</label>
              <select
                value={salesPerson}
                onChange={(e) => setSalesPerson(e.target.value)}
                className="w-full bg-black text-white border border-gray-700 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Sales Person...</option>
                {salespersons.map((person) => (
                  <option key={person.id || person._id} value={person.name}>
                    {person.name}
                  </option>
                ))}
              </select>
              {salesPerson && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-blue-700 text-sm">Selected: {salesPerson}</span>
                  {salespersons.find(p => p.name === salesPerson)?.phone && (
                    <button
                      type="button"
                      onClick={() => {
                        const phone = salespersons.find(p => p.name === salesPerson)?.phone;
                        const message = `New job assigned: ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} - ${selectedServiceType?.name || 'Service'}`;
                        window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank');
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      Notify
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleCreateJob}
              disabled={!selectedServiceType || activeServiceTypes.length === 0}
              className={`w-full mt-4 rounded-lg py-3 px-4 font-bold transition-colors ${!selectedServiceType || activeServiceTypes.length === 0 ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
            >
              Start Job
            </button>
          </div>
        )}
      </div>

      {/* Scanner Modal */}
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
