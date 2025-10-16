import React, { useState, useEffect, useMemo } from 'react';
import { V2 } from '../../utils/v2Client';
import LiveTimer from '../../components/LiveTimer';
import DateUtils from '../../utils/dateUtils';

function JobsView({ jobs, users, currentUser, onRefresh }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 🔍 Enterprise Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  // Sub-tabs and compact view
  const [tab, setTab] = useState('active'); // 'active' | 'completed' | 'qc' | 'all'
  const [compact, setCompact] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    serviceType: '',
    vehicleType: '', // new/used
    detailer: '',
    status: ''
  });

  // 🎯 Keyboard Shortcuts for Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search jobs"]');
        if (searchInput) {
          searchInput.focus();
          setSearchFocus(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const serviceTypes = [...new Set(jobs.map(j => j.serviceType).filter(Boolean))];
    const detailers = Object.values(users || {}).filter(u => u.role === 'detailer');
    const statuses = [...new Set(jobs.map(j => j.status).filter(Boolean))];
    
    return { serviceTypes, detailers, statuses };
  }, [jobs, users]);

  // 🚀 Enterprise Filter & Search Logic
  const filteredJobs = useMemo(() => {
    let filtered = jobs.filter(job => {
      // 🔍 Intelligent Search - searches across multiple fields
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchableFields = [
          job.vin,
          job.stockNumber,
          job.vehicleDescription,
          job.make,
          job.model,
          job.year?.toString(),
          job.color,
          job.serviceType,
          job.technicianName,
          job.salesPerson,
          job.status
        ].filter(Boolean).join(' ').toLowerCase();
        
        // Fuzzy search - allows partial matches
        if (!searchableFields.includes(query)) {
          // Check if query matches any word in the searchable fields
          const queryWords = query.split(' ');
          const matches = queryWords.some(word => 
            searchableFields.includes(word) || 
            searchableFields.split(' ').some(field => field.startsWith(word))
          );
          if (!matches) return false;
        }
      }
      
      // Date filter
      if (filters.startDate) {
        const jobDate = new Date(job.date);
        const startDate = new Date(filters.startDate);
        if (jobDate < startDate) return false;
      }
      
      if (filters.endDate) {
        const jobDate = new Date(job.date);
        const endDate = new Date(filters.endDate);
        if (jobDate > endDate) return false;
      }
      
      // Service type filter
      if (filters.serviceType && job.serviceType !== filters.serviceType) return false;
      
      // Vehicle type filter (new/used)
      if (filters.vehicleType) {
        const vehicleDesc = (job.vehicleDescription || '').toLowerCase();
        if (filters.vehicleType === 'new' && !vehicleDesc.includes('new')) return false;
        if (filters.vehicleType === 'used' && vehicleDesc.includes('new')) return false;
      }
      
      // Detailer filter
      if (filters.detailer && job.technicianId !== filters.detailer) return false;
      
      // Status filter
      if (filters.status && job.status !== filters.status) return false;
      
      return true;
    });
    // Apply tab filter
    if (tab === 'active') {
      filtered = filtered.filter(j => (j.status === 'In Progress' || j.status === 'in_progress' || j.status === 'Pending'));
    } else if (tab === 'completed') {
      filtered = filtered.filter(j => (j.status === 'Completed' || j.status === 'completed'));
    } else if (tab === 'qc') {
      filtered = filtered.filter(j => (j.status === 'QC Required' || j.status === 'qc_required'));
    }

    return filtered;
  }, [jobs, filters, searchQuery, tab]);

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      serviceType: '',
      vehicleType: '',
      detailer: '',
      status: ''
    });
  };

  const getStatusStyles = (status) => {
    const normalized = (status || '').toLowerCase();
    if (['in progress', 'in_progress', 'pending'].includes(normalized)) {
      return 'status-pill bg-[rgba(29,155,240,0.12)] text-[color:var(--x-blue)] border-[rgba(29,155,240,0.35)]';
    }
    if (['completed', 'complete'].includes(normalized)) {
      return 'status-pill bg-[rgba(0,186,124,0.12)] text-[color:var(--x-green)] border-[rgba(0,186,124,0.4)]';
    }
    if (['qc required', 'qc_required'].includes(normalized)) {
      return 'status-pill bg-[rgba(250,130,49,0.12)] text-[#f19a3e] border-[rgba(250,130,49,0.35)]';
    }
    if (['failed qc', 'rejected'].includes(normalized)) {
      return 'status-pill bg-[rgba(244,33,46,0.12)] text-[color:var(--x-red)] border-[rgba(244,33,46,0.35)]';
    }
    return 'status-pill bg-[rgba(139,152,165,0.12)] text-[color:var(--x-text-secondary)] border-[rgba(139,152,165,0.3)]';
  };

  const getPriorityStyles = (priority) => {
    if (!priority || priority === 'Normal') return 'status-pill bg-[rgba(139,152,165,0.1)] text-[color:var(--x-text-secondary)] border-[rgba(139,152,165,0.3)]';
    if (priority === 'Urgent') return 'status-pill bg-[rgba(244,33,46,0.12)] text-[color:var(--x-red)] border-[rgba(244,33,46,0.35)]';
    if (priority === 'High') return 'status-pill bg-[rgba(250,130,49,0.12)] text-[#f19a3e] border-[rgba(250,130,49,0.35)]';
    if (priority === 'Low') return 'status-pill bg-[rgba(29,155,240,0.08)] text-[color:var(--x-blue)] border-[rgba(29,155,240,0.25)]';
    return 'status-pill bg-[rgba(139,152,165,0.1)] text-[color:var(--x-text-secondary)] border-[rgba(139,152,165,0.3)]';
  };

  const openDetails = async (job) => {
    setSelectedJob(job);
    setLoading(true);
    setError('');
    setJobDetails(null);
    try {
      const jobId = job.id || job._id;
      if (!jobId) {
        setError('Job ID not found');
        return;
      }
      const res = await V2.get(`/jobs/${jobId}`);
      if (res.data) {
        setJobDetails(res.data);
      } else {
        setError('Job details not found');
      }
    } catch (err) {
      console.error('Job details error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedJob(null);
    setJobDetails(null);
    setError('');
  };

  return (
    <div className="space-y-8 text-[color:var(--x-text-primary)]">
      <section className="x-card x-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="x-icon-chip">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Job Management</h2>
              <p className="x-text-subtle text-sm">
                {filteredJobs.length} of {jobs.length} jobs
                {searchQuery && ` matching “${searchQuery}”`}
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="x-button x-button--secondary"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className={`relative transition-all duration-200 ${searchFocus ? 'scale-[1.01]' : ''}`}>
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg
                className={`w-5 h-5 transition-colors duration-200 ${searchFocus ? 'text-[color:var(--x-blue)]' : 'text-[color:var(--x-text-secondary)]'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search jobs by VIN, stock number, vehicle, technician, or status…"
              className="x-input x-input--search pr-16"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[color:var(--x-text-secondary)] hover:text-[color:var(--x-text-primary)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <span className="x-search-kbd">⌘F</span>
            </div>
          </div>

          {searchQuery && (
            <div className="flex items-center justify-between text-sm">
              <span className="x-text-subtle">
                {filteredJobs.length} result{filteredJobs.length !== 1 ? 's' : ''} found
              </span>
              {filteredJobs.length === 0 && (
                <span className="text-[color:var(--x-blue)] font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Try a different search term
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 bg-[color:var(--x-surface-elevated)] border border-[color:var(--x-border)] rounded-full p-1">
              {['active', 'completed', 'qc', 'all'].map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                    tab === key
                      ? 'bg-[color:var(--x-blue)] text-black'
                      : 'text-[color:var(--x-text-secondary)] hover:text-[color:var(--x-text-primary)]'
                  }`}
                >
                  {key === 'qc' ? 'QC' : key}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCompact(v => !v)}
              className={`x-button ${compact ? 'x-button--muted' : 'x-button--secondary'}`}
              title="Toggle compact table view"
            >
              {compact ? 'Card View' : 'Table View'}
            </button>
          </div>
        </div>
      </section>

      <section className="x-card x-fade-in">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          <div className="flex flex-col gap-1">
            <label className="x-subtitle">Start</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="x-input x-input--dense"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="x-subtitle">End</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="x-input x-input--dense"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="x-subtitle">Service</label>
            <select
              value={filters.serviceType}
              onChange={e => setFilters(prev => ({ ...prev, serviceType: e.target.value }))}
              className="x-input x-input--dense"
            >
              <option value="">All Types</option>
              {filterOptions.serviceTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="x-subtitle">Vehicle</label>
            <select
              value={filters.vehicleType}
              onChange={e => setFilters(prev => ({ ...prev, vehicleType: e.target.value }))}
              className="x-input x-input--dense"
            >
              <option value="">All</option>
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="x-subtitle">Detailer</label>
            <select
              value={filters.detailer}
              onChange={e => setFilters(prev => ({ ...prev, detailer: e.target.value }))}
              className="x-input x-input--dense"
            >
              <option value="">All</option>
              {filterOptions.detailers.map(detailer => (
                <option key={detailer.id} value={detailer.id}>{detailer.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="x-subtitle">Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="x-input x-input--dense"
            >
              <option value="">All</option>
              {filterOptions.statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="x-subtitle">Showing {filteredJobs.length} of {jobs.length} jobs</span>
          <button
            type="button"
            onClick={clearFilters}
            className="x-button x-button--muted"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Filters
          </button>
        </div>
      </section>

      {/* Jobs List */}
      {!compact ? (
        <section className="x-card x-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="x-title">All Jobs</h3>
            <span className="x-text-subtle text-sm">{filteredJobs.length} results</span>
          </div>
          <div className="job-list-container space-y-2">
            {filteredJobs.length > 0 ? filteredJobs.map(job => (
              <div
                key={job.id || job._id}
                className="job-card cursor-pointer x-fade-in"
                onClick={() => openDetails(job)}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold">{job.year} {job.make} {job.model}</h4>
                      {job.vehicleColor && <span className="x-badge">{job.vehicleColor}</span>}
                      {job.priority && (
                        <span className={getPriorityStyles(job.priority)}>{job.priority}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="x-text-subtle">Stock</span>
                        <span>{job.stockNumber || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="x-text-subtle">VIN</span>
                        <span className="font-mono">{job.vin?.slice(-8) || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="x-text-subtle">Service</span>
                        <span className="text-[color:var(--x-blue)]">{job.serviceType || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="x-text-subtle">Detailer</span>
                        <span>{job.technicianName || job.assignedTo || 'N/A'}</span>
                      </div>
                      {job.salesPerson && (
                        <div className="flex items-center gap-1">
                          <span className="x-text-subtle">Sales</span>
                          <span className="text-[color:var(--x-green)]">{job.salesPerson}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {(job.startTime || job.startedAt) ? (
                        <div className="flex items-center gap-1">
                          <span className="x-text-subtle">Started</span>
                          <span className="text-[color:var(--x-green)]">{DateUtils.formatDateTime(job.startTime || job.startedAt)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="x-text-subtle">Created</span>
                          <span>{DateUtils.formatDateTime(job.date || job.createdAt)}</span>
                        </div>
                      )}
                      {job.completedAt && (
                        <div className="flex items-center gap-1">
                          <span className="x-text-subtle">Completed</span>
                          <span className="text-[color:var(--x-green)]">{DateUtils.formatDateTime(job.completedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 min-w-[140px]">
                    <span className={getStatusStyles(job.status)}>
                      {job.status === 'in_progress' ? 'In Progress' : job.status === 'completed' ? 'Completed' : job.status || 'Pending'}
                    </span>
                    {(job.status === 'In Progress' || job.status === 'in_progress') && job.startTime && (
                      <div className="text-right">
                        <LiveTimer
                          startTime={job.startTime}
                          className="text-[color:var(--x-blue)] font-mono text-sm font-semibold"
                        />
                        <p className="x-text-subtle text-xs mt-0.5">Live</p>
                      </div>
                    )}
                    {(job.status === 'Completed' || job.status === 'completed') && job.completedAt && (job.startTime || job.startedAt) && (
                      <div className="text-right">
                        <p className="text-[color:var(--x-green)] font-semibold text-sm">
                          {DateUtils.formatDuration(
                            DateUtils.calculateDuration(
                              job.startTime || job.startedAt,
                              job.completedAt
                            )
                          )}
                        </p>
                        <p className="x-text-subtle text-xs mt-0.5">Duration</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="x-banner x-fade-in text-center space-y-3">
                <p>No jobs found matching your filters.</p>
                <button type="button" onClick={clearFilters} className="x-button x-button--secondary">Clear Filters</button>
              </div>
            )}
          </div>
        </section>

      ) : (
        <section className="x-card x-fade-in">
          <div className="overflow-x-auto job-list-container">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[color:var(--x-surface)]">
                <tr className="text-[color:var(--x-text-secondary)] border-b border-[color:var(--x-border)]">
                  <th className="text-left py-2 px-3 font-medium">Vehicle</th>
                  <th className="text-left py-2 px-3 font-medium">Stock</th>
                  <th className="text-left py-2 px-3 font-medium">VIN</th>
                  <th className="text-left py-2 px-3 font-medium">Service</th>
                  <th className="text-left py-2 px-3 font-medium">Detailer</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Started</th>
                  <th className="text-left py-2 px-3 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length > 0 ? filteredJobs.map(job => (
                  <tr
                    key={job.id || job._id}
                    className="border-b border-[color:var(--x-border)]/70 hover:bg-[color:var(--x-surface-elevated)] transition-colors cursor-pointer"
                    onClick={() => openDetails(job)}
                  >
                    <td className="py-2 px-3 font-medium text-[color:var(--x-text-primary)]">
                      {job.year} {job.make} {job.model}
                    </td>
                    <td className="py-2 px-3 x-text-subtle">{job.stockNumber || 'N/A'}</td>
                    <td className="py-2 px-3 font-mono x-text-subtle">{job.vin?.slice(-8) || 'N/A'}</td>
                    <td className="py-2 px-3 text-[color:var(--x-blue)]">{job.serviceType || 'N/A'}</td>
                    <td className="py-2 px-3 x-text-subtle">{job.technicianName || job.assignedTo || 'N/A'}</td>
                    <td className="py-2 px-3">
                      <span className={getStatusStyles(job.status)}>
                        {job.status === 'in_progress' ? 'In Progress' : job.status === 'completed' ? 'Completed' : job.status || 'Pending'}
                      </span>
                    </td>
                    <td className="py-2 px-3 x-text-subtle">
                      {(job.startTime || job.startedAt) ? DateUtils.formatDateTime(job.startTime || job.startedAt) : '-'}
                    </td>
                    <td className="py-2 px-3 x-text-subtle">
                      {job.completedAt ? DateUtils.formatDateTime(job.completedAt) : '-'}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="py-6 px-3 text-center x-text-subtle" colSpan="8">
                      No jobs found matching your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {selectedJob && (
        <div className="fixed inset-0 bg-[rgba(15,20,25,0.72)] backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="job-detail-panel w-full max-w-5xl">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-lg font-semibold text-[color:var(--x-text-primary)]">
                  {selectedJob.year} {selectedJob.make} {selectedJob.model}
                </h4>
                {selectedJob.vehicleColor && (
                  <span className="x-badge mt-1">
                    {selectedJob.vehicleColor}
                  </span>
                )}
              </div>
              <button onClick={closeDetails} className="x-button x-button--muted text-sm px-3 py-1">Close</button>
            </div>
            {loading && <p className="x-text-subtle text-center py-6 text-sm">Loading details...</p>}
            {error && <p className="x-banner text-[color:var(--x-red)] text-center text-sm">{error}</p>}
            
            {jobDetails && (
              <div className="space-y-4">
                {/* Compact 3-Column Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="job-detail-section">
                    <h5 className="text-sm font-semibold text-[color:var(--x-text-primary)] mb-2">Vehicle Info</h5>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="x-text-subtle">Vehicle</span>
                        <span className="text-[color:var(--x-text-primary)] font-medium text-right">{selectedJob.vehicleDescription || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="x-text-subtle">Stock</span>
                        <span className="text-[color:var(--x-text-primary)] font-medium">{jobDetails.job?.stockNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="x-text-subtle">VIN</span>
                        <span className="text-[color:var(--x-text-primary)] font-mono text-xs">{jobDetails.job?.vin?.slice(0,10) || 'N/A'}...</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="x-text-subtle">Service</span>
                        <span className="text-[color:var(--x-blue)] font-medium">{jobDetails.job?.serviceType || 'N/A'}</span>
                      </div>
                      {jobDetails.job?.salesPerson && (
                        <div className="flex justify-between gap-2">
                          <span className="x-text-subtle">Sales</span>
                          <span className="text-[color:var(--x-green)] font-medium text-xs">{jobDetails.job.salesPerson}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="job-detail-section">
                    <h5 className="text-sm font-semibold text-[color:var(--x-text-primary)] mb-2">Timing &amp; Status</h5>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="x-text-subtle">Status</span>
                        <span className={getStatusStyles(jobDetails.job?.status)}>
                          {jobDetails.job?.status === 'in_progress' ? 'In Progress' :
                           jobDetails.job?.status === 'completed' ? 'Completed' :
                           jobDetails.job?.status || 'Unknown'}
                        </span>
                      </div>

                      {jobDetails.job?.date && (
                        <div className="flex justify-between gap-2">
                          <span className="x-text-subtle">Created</span>
                          <span className="text-[color:var(--x-text-primary)]">{DateUtils.formatDate(jobDetails.job.date)}</span>
                        </div>
                      )}

                      {(jobDetails.job?.startTime || jobDetails.job?.startedAt) && (
                        <div className="flex justify-between gap-2">
                          <span className="x-text-subtle">Started</span>
                          <span className="text-[color:var(--x-green)]">{DateUtils.formatTime(jobDetails.job.startTime || jobDetails.job.startedAt)}</span>
                        </div>
                      )}

                      {jobDetails.job?.completedAt && (
                        <div className="flex justify-between gap-2">
                          <span className="x-text-subtle">Completed</span>
                          <span className="text-[color:var(--x-green)]">{DateUtils.formatTime(jobDetails.job.completedAt)}</span>
                        </div>
                      )}

                      {(jobDetails.job?.status === 'In Progress' || jobDetails.job?.status === 'in_progress') &&
                       (jobDetails.job?.startTime || jobDetails.job?.startedAt) && (
                        <div className="x-banner mt-3 text-left">
                          <p className="x-text-subtle text-xs mb-1">Duration</p>
                          <LiveTimer
                            startTime={jobDetails.job.startTime || jobDetails.job.startedAt}
                            className="text-[color:var(--x-blue)] font-mono text-base font-semibold"
                          />
                        </div>
                      )}

                      {(jobDetails.job?.status === 'Completed' || jobDetails.job?.status === 'completed') &&
                       jobDetails.job?.completedAt && (jobDetails.job?.startTime || jobDetails.job?.startedAt) && (
                        <div className="x-banner mt-3 text-left">
                          <p className="x-text-subtle text-xs mb-1">Total</p>
                          <p className="text-[color:var(--x-green)] font-mono text-base font-semibold">
                            {DateUtils.formatDuration(
                              DateUtils.calculateDuration(
                                jobDetails.job.startTime || jobDetails.job.startedAt,
                                jobDetails.job.completedAt
                              )
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="job-detail-section">
                    <h5 className="text-sm font-semibold text-[color:var(--x-text-primary)] mb-2">Team &amp; Activity</h5>
                    <div className="space-y-2 text-xs">
                      {(jobDetails.technicians || []).length > 0 && (
                        <div>
                          <p className="x-text-subtle mb-1">Technicians</p>
                          <div className="space-y-0.5">
                            {(jobDetails.technicians || []).map(t => (
                              <p key={t.userId} className="text-[color:var(--x-text-primary)] font-medium">
                                • {t.userName || t.name || t.userId}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {(jobDetails.events || []).length > 0 && (
                        <div className="mt-2">
                          <p className="x-text-subtle mb-1">Recent Events</p>
                          <div className="space-y-0.5 max-h-24 overflow-y-auto">
                            {(jobDetails.events || []).slice(0, 4).map((ev, idx) => (
                              <p key={idx} className="x-text-subtle">
                                • {ev.type?.replace('_', ' ')?.replace(/\\b\\w/g, l => l.toUpperCase()) || 'Event'}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!jobDetails.technicians || jobDetails.technicians.length === 0) &&
                       (!jobDetails.events || jobDetails.events.length === 0) && (
                        <p className="x-text-subtle text-center py-4">No activity yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Action Buttons */}
                {jobDetails.job?.status !== 'completed' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => { 
                        try { 
                          const jobId = jobDetails.job?.id || selectedJob?.id || selectedJob?._id;
                          if (!jobId) return alert('Job ID not found');
                          await V2.put(`/jobs/${jobId}/start`, { userId: currentUser?.id }); 
                          await onRefresh?.(); 
                          closeDetails(); 
                          alert('Timer started');
                        } catch (e) { 
                          alert('Start failed: ' + (e.response?.data?.error || e.message)); 
                        } 
                      }}
                      className="x-button x-button--accent text-sm"
                    >
                      Start Timer
                    </button>
                    <button
                      onClick={async () => { 
                        try { 
                          const jobId = jobDetails.job?.id || selectedJob?.id || selectedJob?._id;
                          if (!jobId) return alert('Job ID not found');
                          await V2.put(`/jobs/${jobId}/stop`, { userId: currentUser?.id }); 
                          await onRefresh?.(); 
                          closeDetails(); 
                          alert('Timer stopped');
                        } catch (e) { 
                          alert('Stop failed: ' + (e.response?.data?.error || e.message)); 
                        } 
                      }}
                      className="x-button x-button--secondary text-sm"
                    >
                      Stop Timer
                    </button>
                    <button
                      onClick={async () => { 
                        try { 
                          const jobId = jobDetails.job?.id || selectedJob?.id || selectedJob?._id;
                          if (!jobId) return alert('Job ID not found');
                          await V2.put(`/jobs/${jobId}/complete`, { 
                            userId: currentUser?.id,
                            completedAt: new Date().toISOString()
                          }); 
                          await onRefresh?.(); 
                          closeDetails(); 
                          alert('Job marked complete');
                        } catch (e) { 
                          alert('Complete failed: ' + (e.response?.data?.error || e.message)); 
                        } 
                      }}
                      className="x-button text-sm"
                    >
                      Mark Complete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default JobsView;
