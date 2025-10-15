import React from 'react';
import { V2 } from '../../utils/v2Client';

function QCView({ jobs, users, currentUser, onRefresh }) {
  const qcJobs = jobs.filter(job => job.status === 'QC Required' || job.status === 'qc_required');

  const todayKey = new Date().toISOString().split('T')[0];
  const approvedToday = jobs.filter(job => {
    if (job.status !== 'Completed' || !job.completedAt) return false;
    return new Date(job.completedAt).toISOString().split('T')[0] === todayKey;
  }).length;

  const rejectedToday = jobs.filter(job => {
    if (!job.qcNotes || !job.updatedAt) return false;
    return new Date(job.updatedAt).toISOString().split('T')[0] === todayKey;
  }).length;

  const handleQCApprove = async (job) => {
    try {
      await V2.put(`/jobs/${job.id}/status`, { status: 'Completed' });
      onRefresh();
      alert('Job approved and marked as completed!');
    } catch (error) {
      console.error('Failed to approve job:', error);
      alert('Failed to approve job: ' + (error.response?.data?.error || error.message));
    }
  };
  
  const handleQCReject = async (job, reason) => {
    try {
      await V2.put(`/jobs/${job.id}/status`, { 
        status: 'In Progress',
        qcNotes: reason 
      });
      onRefresh();
      alert('Job sent back for rework');
    } catch (error) {
      console.error('Failed to reject job:', error);
      alert('Failed to reject job: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-[color:var(--x-text-primary)]">
      <header className="space-y-2">
        <h2 className="text-3xl font-semibold">Quality Control Dashboard</h2>
        <p className="x-text-subtle">Review and approve completed jobs before final delivery.</p>
      </header>

      <section className="x-stat-grid">
        <div className="x-stat-card x-fade-in">
          <span className="x-subtitle">Pending Review</span>
          <p className="x-stat-value">{qcJobs.length}</p>
        </div>
        <div className="x-stat-card x-fade-in">
          <span className="x-subtitle">Approved Today</span>
          <p className="x-stat-value text-[color:var(--x-green)]">{approvedToday}</p>
        </div>
        <div className="x-stat-card x-fade-in">
          <span className="x-subtitle">Rejected Today</span>
          <p className="x-stat-value text-[color:var(--x-red)]">{rejectedToday}</p>
        </div>
      </section>

      <section className="x-card x-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h3 className="x-title">Jobs Awaiting QC Review</h3>
            <p className="x-text-subtle text-sm">
              Click approve to finalize a job or reject with guidance so the team can adjust.
            </p>
          </div>
          <span className="x-badge">{qcJobs.length} Pending</span>
        </div>

        {qcJobs.length === 0 ? (
          <div className="x-banner x-fade-in text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(29,155,240,0.1)] text-[color:var(--x-blue)] mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold">All caught up!</h4>
              <p className="x-text-subtle">No jobs are currently waiting for quality control review.</p>
            </div>
          </div>
        ) : (
          <div className="x-stack">
            {qcJobs.map((job) => (
              <div key={job.id} className="x-row flex-col gap-6 md:flex-row md:items-start">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-lg font-semibold">
                      {job.year} {job.make} {job.model}
                    </h4>
                    {job.vehicleColor && (
                      <span className="x-badge">{job.vehicleColor}</span>
                    )}
                  </div>
                  <div className="grid gap-3 text-sm md:grid-cols-4">
                    <div>
                      <p className="x-text-subtle uppercase text-xs tracking-[0.18em]">VIN</p>
                      <p className="font-mono">{job.vin}</p>
                    </div>
                    <div>
                      <p className="x-text-subtle uppercase text-xs tracking-[0.18em]">Stock</p>
                      <p>{job.stockNumber}</p>
                    </div>
                    <div>
                      <p className="x-text-subtle uppercase text-xs tracking-[0.18em]">Service</p>
                      <p>{job.serviceType}</p>
                    </div>
                    <div>
                      <p className="x-text-subtle uppercase text-xs tracking-[0.18em]">Technician</p>
                      <p>{job.technicianName}</p>
                    </div>
                  </div>
                  {job.completedAt && (
                    <p className="text-sm x-text-subtle">
                      Completed {new Date(job.completedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <button
                    onClick={() => handleQCApprove(job)}
                    className="x-button w-full"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter reason for rejection (this will be sent back to the technician):');
                      if (reason) handleQCReject(job, reason);
                    }}
                    className="x-button x-button--danger w-full"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
export default QCView;
