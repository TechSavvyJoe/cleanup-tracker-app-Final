import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { V2 } from '../../utils/v2Client';
import DateUtils from '../../utils/dateUtils';

/* eslint-disable no-unused-vars */
function ReportsView({ jobs = [], users = {} }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [selectedDetailer, setSelectedDetailer] = useState(null);
  const [selectedServiceType, setSelectedServiceType] = useState(null);
  const [drillDownJobs, setDrillDownJobs] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch reports data from API
  const fetchReportsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (start) params.append('startDate', start);
      if (end) params.append('endDate', end);
      
      const response = await V2.get('/reports?' + params.toString());
      setReportData(response.data);
    } catch (err) {
      console.error('Reports fetch error:', err);
      setError('Failed to load reports: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  // Fetch data on mount and when dates change
  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  const filtered = useMemo(() => {
    try {
      if (!start && !end) return jobs;
      const s = start ? new Date(start) : null;
      const e = end ? new Date(end) : null;
      return jobs.filter(j => {
        const jobDate = new Date(j.date || j.startTime || j.createdAt);
        if (s && jobDate < s) return false;
        if (e && jobDate > e) return false;
        return true;
      });
    } catch (err) {
      console.error('Filter error:', err);
      return jobs;
    }
  }, [jobs, start, end]);

  // Use API data if available, fallback to client-side calculation
  const displayData = useMemo(() => {
    if (reportData) {
      return {
        totalLast7Days: reportData.last7Days,
        completedLast7Days: reportData.last7Days, // Assume completed for now
        serviceTypeCounts: reportData.serviceTypes.reduce((acc, st) => ({ ...acc, [st.name]: st.jobs }), {}),
        serviceTypePerformance: reportData.serviceTypes,
        detailerPerformance: reportData.detailerPerformance,
        dailyStats: reportData.dailyTrends.reduce((acc, day) => ({ 
          ...acc, 
          [day.date]: { total: day.jobs, completed: day.completed } 
        }), {}),
        filteredTotal: reportData.periodTotal,
        filteredCompleted: reportData.completed,
        completionRate: reportData.completionRate
      };
    }
    
    // Fallback to filtered jobs if no API data
    const fallbackFiltered = filtered.length > 0 ? filtered : jobs;
    return {
      totalLast7Days: fallbackFiltered.length,
      completedLast7Days: fallbackFiltered.filter(j => j.status === 'Completed').length,
      serviceTypeCounts: fallbackFiltered.reduce((acc, job) => {
        acc[job.serviceType] = (acc[job.serviceType] || 0) + 1;
        return acc;
      }, {}),
      serviceTypePerformance: [],
      detailerPerformance: [],
      dailyStats: {},
      filteredTotal: fallbackFiltered.length,
      filteredCompleted: fallbackFiltered.filter(j => j.status === 'Completed').length,
      completionRate: fallbackFiltered.length > 0 ? Math.round((fallbackFiltered.filter(j => j.status === 'Completed').length / fallbackFiltered.length) * 100) : 0
    };
  }, [reportData, filtered, jobs]);

  const dailyEntries = useMemo(() => {
    const entries = Object.entries(displayData.dailyStats || {});
    return entries.slice(-7);
  }, [displayData.dailyStats]);

  const hasDetailerData = (displayData.detailerPerformance || []).length > 0;
  const hasServiceData = (displayData.serviceTypePerformance || []).length > 0;

  const getStatusBadge = (status) => {
    const normalized = (status || '').toLowerCase();
    if (['completed', 'complete'].includes(normalized)) {
      return 'status-pill bg-[rgba(0,186,124,0.12)] text-[color:var(--x-green)] border-[rgba(0,186,124,0.4)]';
    }
    if (['in progress', 'in_progress', 'pending'].includes(normalized)) {
      return 'status-pill bg-[rgba(29,155,240,0.12)] text-[color:var(--x-blue)] border-[rgba(29,155,240,0.35)]';
    }
    return 'status-pill bg-[rgba(139,152,165,0.12)] text-[color:var(--x-text-secondary)] border-[rgba(139,152,165,0.3)]';
  };

// Interactive drill-down functions
  const handleDetailerClick = (detailer) => {
    setSelectedDetailer(detailer.name || detailer);
    setDrillDownJobs(detailer.recentJobs || []);
    setShowDrillDown(true);
  };

  const handleServiceTypeClick = (serviceType) => {
    setSelectedServiceType(serviceType.name || serviceType);
    setDrillDownJobs(serviceType.jobs || []);
    setShowDrillDown(true);
  };

  const closeDrillDown = () => {
    setShowDrillDown(false);
    setSelectedDetailer(null);
    setSelectedServiceType(null);
    setDrillDownJobs([]);
  };



  const exportPdf = async () => {
    try {
      // Create comprehensive HTML report that can be printed as PDF
      const period = start && end ? `${start} to ${end}` : 'All Time';
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cleanup Tracker Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: white; color: black; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
        .section { margin-bottom: 25px; }
        .section h2 { background: #f0f0f0; padding: 10px; margin: 0 0 15px 0; border-left: 4px solid #007acc; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd; }
        .stat-value { font-size: 24px; font-weight: bold; color: #007acc; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f0f0f0; font-weight: bold; }
        .performance-table td:nth-child(2), .performance-table td:nth-child(3), .performance-table td:nth-child(4), .performance-table td:nth-child(5) { text-align: right; }
        .service-item { margin-bottom: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        @media print { body { margin: 0; } .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚗 CLEANUP TRACKER</h1>
        <h2>Performance Report</h2>
        <p><strong>Report Period:</strong> ${period} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="section">
        <h2>📊 Summary Statistics</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${displayData.filteredTotal}</div>
                <div class="stat-label">Total Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${displayData.filteredCompleted}</div>
                <div class="stat-label">Completed Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${displayData.avgEfficiency || 'N/A'}</div>
                <div class="stat-label">Avg Time/Job</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${displayData.totalLast7Days}</div>
                <div class="stat-label">Last 7 Days</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>👥 Detailer Performance</h2>
        <table class="performance-table">
            <thead>
                <tr>
                    <th>Detailer Name</th>
                    <th>Total Jobs</th>
                    <th>Completed</th>
                    <th>Success Rate</th>
                    <th>Avg Time</th>
                    <th>Top Services</th>
                </tr>
            </thead>
            <tbody>
                ${displayData.detailerPerformance.map(perf => {
                    const completionRate = perf.totalJobs ? Math.round((perf.completedJobs / perf.totalJobs) * 100) : 0;
                    const avgTimeStr = perf.avgTime ? DateUtils.formatDuration(perf.avgTime) : 'N/A';
                    const topServices = Object.entries(perf.serviceTypes).sort(([,a], [,b]) => b - a).slice(0, 3).map(([k,v]) => `${k}(${v})`).join(', ');
                    return `
                    <tr>
                        <td><strong>${perf.name}</strong></td>
                        <td>${perf.totalJobs}</td>
                        <td>${perf.completedJobs}</td>
                        <td>${completionRate}%</td>
                        <td>${avgTimeStr}</td>
                        <td>${topServices}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>🔧 Service Type Breakdown</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
            ${Object.entries(displayData.serviceTypeCounts).map(([type, count]) => {
                const percentage = displayData.filteredTotal ? Math.round((count / displayData.filteredTotal) * 100) : 0;
                return `<div class="service-item"><strong>${type}</strong>: ${count} jobs (${percentage}%)</div>`;
            }).join('')}
        </div>
    </div>

    <div class="section">
        <h2>📅 Recent Activity</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Detailer</th>
                    <th>Service</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.slice(0, 50).map(job => {
                    const duration = job.duration ? DateUtils.formatDuration(job.duration) : DateUtils.formatDuration(DateUtils.calculateDuration(job.startTime || job.startedAt, job.completedAt));
                    return `
                    <tr>
                        <td>${job.date}</td>
                        <td>${job.technicianName}</td>
                        <td>${job.serviceType}</td>
                        <td>${job.vehicleDescription}</td>
                        <td>${job.status}</td>
                        <td>${duration}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>Report generated by Cleanup Tracker - Professional Vehicle Management System</p>
        <p class="no-print">To save as PDF: Use your browser's Print function and select "Save as PDF"</p>
    </div>
</body>
</html>`;

      // Create and open HTML report in new window for printing/PDF
      const newWindow = window.open('', '_blank');
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      
      // Auto-trigger print dialog
      setTimeout(() => {
        newWindow.print();
      }, 1000);
      
      alert('PDF report opened in new window. Use your browser\'s print function to save as PDF.');
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-12">
        <section className="x-card x-fade-in text-center space-y-4">
          <span className="x-icon-chip text-[color:var(--x-red)]">!</span>
          <h3 className="text-lg font-semibold text-[color:var(--x-text-primary)]">Reports failed to load</h3>
          <p className="x-text-subtle">{error}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setError(null)} className="x-button">Try Again</button>
            <button onClick={() => { setError(null); setStart(''); setEnd(''); }} className="x-button x-button--secondary">Reset Filters</button>
          </div>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <section className="x-card x-fade-in text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-[color:var(--x-border)] border-t-[color:var(--x-blue)] rounded-full animate-spin"></div>
          </div>
          <p className="text-sm x-text-subtle">Gathering your reports and analytics…</p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 text-[color:var(--x-text-primary)] px-4">
      <section className="x-card x-fade-in">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="x-subtitle" htmlFor="reports-start">Start Date</label>
            <input
              id="reports-start"
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="x-input x-input--dense"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="x-subtitle" htmlFor="reports-end">End Date</label>
            <input
              id="reports-end"
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="x-input x-input--dense"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-6">
          <button
            type="button"
            onClick={() => {
              const headers = ['Date', 'Technician', 'Service Type', 'Vehicle', 'Status', 'Duration'].join(',');
              const rows = filtered.map(job => {
                const duration = job.duration || DateUtils.calculateDuration(job.startTime || job.startedAt, job.completedAt);
                return [
                  job.date,
                  job.technicianName || 'Unknown',
                  job.serviceType || 'N/A',
                  job.vehicleDescription || '',
                  job.status || 'Unknown',
                  DateUtils.formatDuration(duration)
                ].map(v => `"${v}"`).join(',');
              });
              const csv = [headers, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'cleanup-tracker-report.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="x-button"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const json = JSON.stringify(filtered, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'cleanup-tracker-report.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="x-button x-button--secondary"
          >
            Export JSON
          </button>
          <button type="button" onClick={exportPdf} className="x-button x-button--muted">
            Export Report
          </button>
          <button type="button" onClick={() => { setStart(''); setEnd(''); }} className="x-button x-button--muted">
            Clear Filters
          </button>
        </div>
      </section>

      <div className="x-stat-grid">
        <div className="x-stat-card x-fade-in">
          <span className="x-subtitle">Period Total</span>
          <p className="x-stat-value">{displayData.filteredTotal}</p>
        </div>
        <div className="x-stat-card x-fade-in">
          <span className="x-subtitle">Completed</span>
          <p className="x-stat-value text-[color:var(--x-green)]">{displayData.filteredCompleted}</p>
        </div>
        <div className="x-stat-card x-fade-in">
          <span className="x-subtitle">Avg Time / Job</span>
          <p className="x-stat-value text-[color:var(--x-blue)]">{displayData.avgEfficiency || 'N/A'}</p>
        </div>
        <div className="x-stat-card x-fade-in">
          <span className="x-subtitle">Last 7 Days</span>
          <p className="x-stat-value text-[color:var(--x-text-primary)]">{displayData.totalLast7Days}</p>
        </div>
      </div>

      {hasDetailerData && (
        <section className="x-card x-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="x-title text-lg">Detailer Performance</h3>
            <span className="x-text-subtle text-sm">Click a row for drill down</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[color:var(--x-text-secondary)] border-b border-[color:var(--x-border)] text-xs uppercase tracking-[0.15em]">
                  <th className="text-left py-3">Name</th>
                  <th className="text-right py-3">Total Jobs</th>
                  <th className="text-right py-3">Avg Time</th>
                  <th className="text-right py-3">Min Time</th>
                  <th className="text-right py-3">Max Time</th>
                  <th className="text-right py-3">Recent Jobs</th>
                </tr>
              </thead>
              <tbody>
                {displayData.detailerPerformance.map((perf, idx) => {
                  const avgTimeStr = perf.avgTime ? DateUtils.formatDuration(perf.avgTime) : 'N/A';
                  const minTimeStr = perf.minTime ? DateUtils.formatDuration(perf.minTime) : 'N/A';
                  const maxTimeStr = perf.maxTime ? DateUtils.formatDuration(perf.maxTime) : 'N/A';
                  return (
                    <tr
                      key={idx}
                      className="border-b border-[color:var(--x-border)]/60 hover:bg-[color:var(--x-surface-elevated)] transition-colors cursor-pointer"
                      onClick={() => handleDetailerClick(perf)}
                    >
                      <td className="py-3 font-medium">{perf.name}</td>
                      <td className="py-3 text-right x-text-subtle">{perf.totalJobs}</td>
                      <td className="py-3 text-right text-[color:var(--x-green)] font-medium">{avgTimeStr}</td>
                      <td className="py-3 text-right text-[color:var(--x-blue)]">{minTimeStr}</td>
                      <td className="py-3 text-right text-[color:var(--x-red)]">{maxTimeStr}</td>
                      <td className="py-3 text-right x-text-subtle">{perf.recentJobs ? perf.recentJobs.length : 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="x-card x-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="x-title text-lg">Service Types</h3>
            <span className="x-text-subtle text-sm">Click to drill down</span>
          </div>
          <div className="space-y-3">
            {hasServiceData ? (
              displayData.serviceTypePerformance.map((data, idx) => {
                const avgTimeStr = data.avgTime ? DateUtils.formatDuration(data.avgTime) : 'N/A';
                const minTimeStr = data.minTime ? DateUtils.formatDuration(data.minTime) : 'N/A';
                const maxTimeStr = data.maxTime ? DateUtils.formatDuration(data.maxTime) : 'N/A';
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleServiceTypeClick(data)}
                    className="w-full text-left x-banner hover:border-[color:var(--x-border-hover)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[color:var(--x-text-primary)]">{data.name}</span>
                      <span className="x-text-subtle text-sm">{data.jobs?.length || 0} jobs</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-xs x-text-subtle">
                      <div>
                        <p>Avg</p>
                        <p className="text-[color:var(--x-blue)] font-medium">{avgTimeStr}</p>
                      </div>
                      <div>
                        <p>Min</p>
                        <p className="text-[color:var(--x-green)] font-medium">{minTimeStr}</p>
                      </div>
                      <div>
                        <p>Max</p>
                        <p className="text-[color:var(--x-red)] font-medium">{maxTimeStr}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="x-text-subtle text-sm">No service type data available.</p>
            )}
          </div>
        </section>

        <section className="x-card x-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="x-title text-lg">Daily Activity</h3>
            <span className="x-text-subtle text-sm">Last {dailyEntries.length} days</span>
          </div>
          <div className="space-y-2">
            {dailyEntries.length > 0 ? (
              dailyEntries.map(([date, stats]) => (
                <div key={date} className="flex items-center justify-between text-sm x-banner">
                  <span>{DateUtils.formatDate(date)}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[color:var(--x-blue)]">{stats.total} total</span>
                    <span className="text-[color:var(--x-green)]">{stats.completed} complete</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="x-text-subtle text-sm">No recent daily stats available.</p>
            )}
          </div>
        </section>
      </div>

      <section className="x-card x-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="x-title text-lg">Recent Jobs</h3>
          <span className="x-text-subtle text-sm">Showing {Math.min(filtered.length, 50)} of {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[color:var(--x-text-secondary)] border-b border-[color:var(--x-border)] text-xs uppercase tracking-[0.15em]">
                <th className="text-left py-3">Date</th>
                <th className="text-left py-3">Detailer</th>
                <th className="text-left py-3">Service</th>
                <th className="text-left py-3">Vehicle</th>
                <th className="text-left py-3">Status</th>
                <th className="text-left py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((job, idx) => {
                const duration = job.duration
                  ? DateUtils.formatDuration(job.duration)
                  : DateUtils.formatDuration(DateUtils.calculateDuration(job.startTime || job.startedAt, job.completedAt));
                return (
                  <tr key={idx} className="border-b border-[color:var(--x-border)]/60 hover:bg-[color:var(--x-surface-elevated)] transition-colors">
                    <td className="py-3 x-text-subtle">{job.date}</td>
                    <td className="py-3">{job.technicianName || 'Unknown'}</td>
                    <td className="py-3 x-text-subtle">{job.serviceType || 'N/A'}</td>
                    <td className="py-3 x-text-subtle">{job.vehicleDescription || '—'}</td>
                    <td className="py-3">
                      <span className={getStatusBadge(job.status)}>{job.status || 'Pending'}</span>
                    </td>
                    <td className="py-3 text-[color:var(--x-green)] font-medium">{duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showDrillDown && (
        <div className="fixed inset-0 bg-[rgba(15,20,25,0.72)] backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="job-detail-panel w-full max-w-5xl space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--x-text-primary)]">
                  {selectedDetailer ? `${selectedDetailer} - Job Details` : `${selectedServiceType} - Job Details`}
                </h3>
                <p className="x-text-subtle text-sm">Showing {drillDownJobs.length} jobs</p>
              </div>
              <button onClick={closeDrillDown} className="x-button x-button--secondary">Close</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[color:var(--x-text-secondary)] border-b border-[color:var(--x-border)] text-xs uppercase tracking-[0.15em]">
                    <th className="text-left py-3">VIN</th>
                    <th className="text-left py-3">Service Type</th>
                    <th className="text-left py-3">Detailer</th>
                    <th className="text-left py-3">Status</th>
                    <th className="text-left py-3">Duration</th>
                    <th className="text-left py-3">Started</th>
                    <th className="text-left py-3">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDownJobs.map((job, idx) => {
                    const startTime = DateUtils.getValidDate(job.startTime || job.startedAt || job.createdAt || job.timestamp || job.date);
                    const endTime = DateUtils.getValidDate(job.completedAt);
                    const duration = startTime && endTime
                      ? DateUtils.formatDuration(DateUtils.calculateDuration(startTime, endTime))
                      : (startTime ? 'In Progress' : 'N/A');
                    return (
                      <tr key={idx} className="border-b border-[color:var(--x-border)]/60">
                        <td className="py-3 font-mono x-text-subtle">{job.vin || 'N/A'}</td>
                        <td className="py-3 x-text-subtle">{job.serviceType || 'N/A'}</td>
                        <td className="py-3 x-text-subtle">{job.detailer || job.assignedTo || 'N/A'}</td>
                        <td className="py-3">
                          <span className={getStatusBadge(job.status)}>{job.status || 'Pending'}</span>
                        </td>
                        <td className="py-3 text-[color:var(--x-green)] font-medium">{duration}</td>
                        <td className="py-3 x-text-subtle">
                          {startTime ? DateUtils.formatDateTime(startTime) : 'N/A'}
                        </td>
                        <td className="py-3 x-text-subtle">
                          {endTime ? DateUtils.formatDateTime(endTime) : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ReportsView;
