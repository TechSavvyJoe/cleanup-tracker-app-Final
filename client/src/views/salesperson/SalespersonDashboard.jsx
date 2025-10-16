import React, { useMemo, useState, useCallback } from 'react';
import { V2 } from '../../utils/v2Client';
import { useToast } from '../../components/Toast';

const normalizeValue = (value) => (value ?? '').toString().trim().toLowerCase();

const STATUS_KEYS = {
  completed: ['completed', 'complete', 'done', 'finished'],
  qc: ['qc required', 'qc_required', 'qc pending', 'pending qc', 'needs qc', 'quality control'],
  failed: ['failed qc', 'qc failed', 'rejected', 'fail qc', 'failed', 'qc issue'],
  active: ['in progress', 'in_progress', 'active', 'assigned', 'started', 'pending', 'scheduled']
};

const getStatusKey = (status) => {
  const normalized = normalizeValue(status);
  if (!normalized) return 'other';
  if (STATUS_KEYS.completed.includes(normalized)) return 'completed';
  if (STATUS_KEYS.qc.includes(normalized)) return 'qc';
  if (STATUS_KEYS.failed.includes(normalized)) return 'failed';
  if (STATUS_KEYS.active.includes(normalized)) return 'active';
  return 'other';
};

const STATUS_ORDER = {
  active: 0,
  qc: 1,
  failed: 2,
  completed: 3,
  other: 4
};

const getStatusMeta = (status) => {
  const key = getStatusKey(status);
  if (key === 'active') {
    return {
      label: 'In Progress',
      className: 'bg-[rgba(29,155,240,0.12)] text-[color:var(--x-blue)] border-[rgba(29,155,240,0.35)]'
    };
  }
  if (key === 'completed') {
    return {
      label: 'Completed',
      className: 'bg-[rgba(0,186,124,0.12)] text-[color:var(--x-green)] border-[rgba(0,186,124,0.4)]'
    };
  }
  if (key === 'qc') {
    return {
      label: 'QC Review',
      className: 'bg-[rgba(241,160,31,0.12)] text-[#f1a01f] border-[rgba(241,160,31,0.35)]'
    };
  }
  if (key === 'failed') {
    return {
      label: 'QC Failed',
      className: 'bg-[rgba(244,33,46,0.12)] text-[color:var(--x-red)] border-[rgba(244,33,46,0.35)]'
    };
  }
  return {
    label: status || 'Pending',
    className: 'bg-[rgba(139,152,165,0.12)] text-[color:var(--x-text-secondary)] border-[rgba(139,152,165,0.35)]'
  };
};

const getPriorityRank = (priority) => {
  const normalized = normalizeValue(priority);
  if (normalized === 'urgent') return 0;
  if (normalized === 'high') return 1;
  if (normalized === 'normal' || normalized === '') return 2;
  if (normalized === 'low') return 3;
  return 4;
};

const getPriorityMeta = (priority) => {
  const normalized = normalizeValue(priority);
  if (!normalized || normalized === 'normal') {
    return null;
  }

  if (normalized === 'urgent') {
    return {
      label: 'Urgent',
      className: 'bg-[rgba(244,33,46,0.12)] text-[color:var(--x-red)] border-[rgba(244,33,46,0.35)]'
    };
  }

  if (normalized === 'high') {
    return {
      label: 'High Priority',
      className: 'bg-[rgba(125,211,252,0.12)] text-[#38bdf8] border-[rgba(125,211,252,0.35)]'
    };
  }

  if (normalized === 'low') {
    return {
      label: 'Low Priority',
      className: 'bg-[rgba(139,152,165,0.12)] text-[color:var(--x-text-secondary)] border-[rgba(139,152,165,0.35)]'
    };
  }

  return {
    label: priority,
    className: 'bg-[rgba(139,152,165,0.12)] text-[color:var(--x-text-secondary)] border-[rgba(139,152,165,0.35)]'
  };
};

const isCompletedStatus = (status) => getStatusKey(status) === 'completed';
const isActiveStatus = (status) => getStatusKey(status) === 'active';
const isQcStatus = (status) => getStatusKey(status) === 'qc';
const isFailedStatus = (status) => getStatusKey(status) === 'failed';

const getJobTimestamp = (job) => {
  const candidate = job?.updatedAt || job?.completedAt || job?.startTime || job?.createdAt || job?.timestamp;
  const date = candidate ? new Date(candidate) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

function SalespersonDashboard({ user, jobs }) {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingAction, setPendingAction] = useState({ jobId: null, type: null });

  const myJobs = useMemo(() => {
    if (!Array.isArray(jobs) || !user) return [];

    const identifiers = [user.name, user.employeeId, user.id]
      .filter(Boolean)
      .map((value) => normalizeValue(value));

    const matchesSalesperson = (job) => {
      const candidates = [
        job.salesPerson,
        job.salesperson,
        job.salesPersonName,
        job.salesPersonId,
        job.salespersonId,
        ...(Array.isArray(job.salesPeople) ? job.salesPeople : []),
        ...(Array.isArray(job.salesPersonIds) ? job.salesPersonIds : []),
        ...(Array.isArray(job.assignedSalespersonIds) ? job.assignedSalespersonIds : [])
      ];

      return candidates
        .filter(Boolean)
        .map((value) => normalizeValue(value))
        .some((value) => identifiers.includes(value));
    };

    return jobs
      .filter(matchesSalesperson)
      .sort((a, b) => {
        const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
        if (priorityDiff !== 0) return priorityDiff;
        const statusDiff = (STATUS_ORDER[getStatusKey(a.status)] ?? STATUS_ORDER.other) - (STATUS_ORDER[getStatusKey(b.status)] ?? STATUS_ORDER.other);
        if (statusDiff !== 0) return statusDiff;
        return getJobTimestamp(b) - getJobTimestamp(a);
      });
  }, [jobs, user]);

  const metrics = useMemo(() => {
    const total = myJobs.length;
    const active = myJobs.filter((job) => isActiveStatus(job.status)).length;
    const completed = myJobs.filter((job) => isCompletedStatus(job.status)).length;
    const qcPending = myJobs.filter((job) => isQcStatus(job.status)).length;
    const failed = myJobs.filter((job) => isFailedStatus(job.status)).length;
    const urgent = myJobs.filter((job) => normalizeValue(job.priority) === 'urgent').length;
    return { total, active, completed, qcPending, failed, urgent };
  }, [myJobs]);

  const filteredJobs = useMemo(() => {
    if (statusFilter === 'active') return myJobs.filter((job) => isActiveStatus(job.status));
    if (statusFilter === 'completed') return myJobs.filter((job) => isCompletedStatus(job.status));
    if (statusFilter === 'qc') return myJobs.filter((job) => isQcStatus(job.status));
    if (statusFilter === 'failed') return myJobs.filter((job) => isFailedStatus(job.status));
    return myJobs;
  }, [myJobs, statusFilter]);

  const filterOptions = useMemo(() => ([
    { key: 'all', label: 'All', count: metrics.total },
    { key: 'active', label: 'Active', count: metrics.active },
    { key: 'qc', label: 'QC Review', count: metrics.qcPending },
    { key: 'completed', label: 'Completed', count: metrics.completed },
    { key: 'failed', label: 'QC Failed', count: metrics.failed }
  ]).filter((option) => option.count > 0 || option.key === 'all'), [metrics]);

  const metricCards = useMemo(() => ([
    {
      key: 'total',
      label: 'Assigned Jobs',
      value: metrics.total,
      caption: 'Jobs currently linked to you',
      accent: 'from-[rgba(29,155,240,0.4)] via-[rgba(29,155,240,0.15)] to-transparent',
      icon: (
        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      key: 'active',
      label: 'Active Now',
      value: metrics.active,
      caption: 'Vehicles progressing or awaiting QC',
      accent: 'from-[rgba(29,155,240,0.35)] via-[rgba(29,155,240,0.12)] to-transparent',
      icon: (
        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      key: 'completed',
      label: 'Completed',
      value: metrics.completed,
      caption: 'Finished jobs pending delivery',
      accent: 'from-[rgba(0,186,124,0.35)] via-[rgba(0,186,124,0.12)] to-transparent',
      icon: (
        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    {
      key: 'qc',
      label: 'QC Review',
      value: metrics.qcPending,
      caption: `${metrics.urgent} urgent job${metrics.urgent === 1 ? '' : 's'} need follow-up`,
      accent: 'from-[rgba(241,160,31,0.35)] via-[rgba(241,160,31,0.12)] to-transparent',
      icon: (
        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 17h.01M12 9h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ]), [metrics]);

  const handleQualityCheck = useCallback(async (jobId, passed) => {
    if (!jobId) {
      toast.error('Unable to update job without an ID');
      return;
    }
    if (!user) {
      toast.error('User details missing');
      return;
    }

    setPendingAction({ jobId, type: 'qc' });

    try {
      await V2.post(`/jobs/${jobId}/qc`, {
        qcCheckerId: user.employeeId || user.id,
        qcCheckerName: user.name,
        qcPassed: passed,
        qcNotes: passed ? 'Quality check passed' : 'Quality check failed - needs attention'
      });
      toast.success(`QC ${passed ? 'approval recorded' : 'issue flagged'} successfully`);
    } catch (err) {
      console.error('QC update failed:', err);
      toast.error('QC update failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setPendingAction({ jobId: null, type: null });
    }
  }, [toast, user]);

  const handleMessage = useCallback(async (jobId, recipientType) => {
    if (!jobId) {
      toast.error('Unable to send message without an ID');
      return;
    }
    if (!user) {
      toast.error('User details missing');
      return;
    }

    const rawMessage = window.prompt('Enter your message:');
    if (!rawMessage || !rawMessage.trim()) {
      return;
    }

    setPendingAction({ jobId, type: 'message' });

    try {
      await V2.post(`/jobs/${jobId}/message`, {
        message: rawMessage.trim(),
        fromUserId: user.id,
        fromUserName: user.name,
        recipientType
      });
      toast.success('Message sent successfully');
    } catch (err) {
      console.error('Message failed:', err);
      toast.error('Message failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setPendingAction({ jobId: null, type: null });
    }
  }, [toast, user]);

  const emptyState = statusFilter === 'all'
    ? { title: 'No jobs assigned yet', description: 'Jobs assigned to you will appear here.' }
    : { title: 'Nothing to show', description: 'Try a different status filter to see more jobs.' };

  return (
    <div className="min-h-screen bg-[#050507] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface)] px-6 py-6 shadow-[0_20px_55px_rgba(4,5,7,0.55)] sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[rgba(29,155,240,0.35)] bg-[rgba(29,155,240,0.1)] shadow-[0_20px_45px_rgba(29,155,240,0.25)]">
                <svg className="h-8 w-8 text-[color:var(--x-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Sales Dashboard</h1>
                <p className="mt-1 text-sm text-[color:var(--x-text-secondary)]">Welcome back, {user?.name || 'Sales team'}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--x-border)] bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">
              Assigned • {metrics.total}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((card) => (
              <div key={card.key} className="rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface-elevated)]/95 p-6 shadow-[0_25px_55px_rgba(5,6,8,0.65)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--x-text-secondary)]">{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{card.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent bg-gradient-to-br ${card.accent}`}>
                    {card.icon}
                  </div>
                </div>
                {card.caption && (
                  <p className="mt-4 text-xs text-[color:var(--x-text-secondary)]">{card.caption}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--x-text-secondary)]">Filter by status</div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStatusFilter(option.key)}
                  className={`group flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                    statusFilter === option.key
                      ? 'border-[rgba(29,155,240,0.45)] bg-[rgba(29,155,240,0.18)] text-white shadow-[0_0_25px_rgba(29,155,240,0.35)]'
                      : 'border-transparent bg-[rgba(15,20,25,0.75)] text-[color:var(--x-text-secondary)] hover:border-[rgba(29,155,240,0.3)] hover:text-white'
                  }`}
                >
                  <span>{option.label}</span>
                  <span className="rounded-full bg-black/40 px-2 py-0.5 text-[0.65rem] font-semibold text-[color:var(--x-text-secondary)] transition-colors group-hover:text-white">{option.count}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface)]/95 p-6 shadow-[0_25px_60px_rgba(3,4,6,0.65)] sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">My Vehicle Jobs</h2>
              <p className="mt-1 text-sm text-[color:var(--x-text-secondary)]">{filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'} in this view</p>
            </div>
          </div>

          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const statusMeta = getStatusMeta(job.status);
              const priorityMeta = getPriorityMeta(job.priority);
              const resolvedJobId = job.id || job._id || job.jobId;
              const isQcPending = pendingAction.jobId === resolvedJobId && pendingAction.type === 'qc';
              const isMessagePending = pendingAction.jobId === resolvedJobId && pendingAction.type === 'message';

              return (
                <div
                  key={resolvedJobId || `${job.vin}-${job.stockNumber}`}
                  className="job-card relative overflow-hidden rounded-3xl border border-[color:var(--x-border)] bg-[color:var(--x-surface-elevated)]/90 p-6 shadow-[0_30px_65px_rgba(5,6,8,0.7)] transition-all hover:border-[color:var(--x-border-hover)] hover:shadow-[0_38px_85px_rgba(5,6,8,0.85)]"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white sm:text-xl">
                            {job.year} {job.make} {job.model} {job.vehicleColor && `• ${job.vehicleColor}`}
                          </h3>
                          <p className="mt-1 text-sm text-[color:var(--x-text-secondary)]">{job.stockNumber ? `Stock ${job.stockNumber}` : 'Stock pending'} • {job.vin ? `VIN • ${job.vin.slice(-6)}` : 'VIN unavailable'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-[rgba(29,155,240,0.3)] bg-[rgba(29,155,240,0.12)] px-3 py-1 text-xs font-semibold text-[color:var(--x-blue)]">
                            {job.serviceType || 'Service TBD'}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm text-[color:var(--x-text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <p className="uppercase tracking-[0.18em] text-[0.65rem] text-[color:var(--x-text-secondary)]">Technician</p>
                          <p className="mt-1 text-white">{job.technicianName || 'Unassigned'}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.18em] text-[0.65rem] text-[color:var(--x-text-secondary)]">Status</p>
                          <p className="mt-1 text-white">{statusMeta.label}</p>
                        </div>
                        {job.date && (
                          <div>
                            <p className="uppercase tracking-[0.18em] text-[0.65rem] text-[color:var(--x-text-secondary)]">Scheduled</p>
                            <p className="mt-1 text-white">{job.date}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusMeta.label}
                        </span>
                        {priorityMeta && (
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${priorityMeta.className}`}>
                            {priorityMeta.label}
                          </span>
                        )}
                        {job.qcCompleted && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(0,186,124,0.35)] bg-[rgba(0,186,124,0.12)] px-3 py-1 text-xs font-semibold text-[color:var(--x-green)]">
                            QC Complete
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:w-[200px]">
                      {isCompletedStatus(job.status) && !job.qcCompleted && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleQualityCheck(resolvedJobId, true)}
                            disabled={isQcPending}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                              isQcPending
                                ? 'cursor-not-allowed bg-[rgba(0,186,124,0.2)] text-[color:var(--x-green)]'
                                : 'bg-[color:var(--x-green)] text-black hover:bg-[#12d18c]'
                          }`}
                          >
                            Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQualityCheck(resolvedJobId, false)}
                            disabled={isQcPending}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                              isQcPending
                                ? 'cursor-not-allowed bg-[rgba(244,33,46,0.2)] text-[color:var(--x-red)]'
                                : 'bg-[color:var(--x-red)] text-white hover:bg-[#ff5461]'
                          }`}
                          >
                            Fail
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleMessage(resolvedJobId, 'detailer')}
                        disabled={isMessagePending}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          isMessagePending
                            ? 'cursor-not-allowed bg-[rgba(29,155,240,0.2)] text-[color:var(--x-blue)]'
                            : 'bg-[color:var(--x-blue)] text-black hover:bg-[color:var(--x-blue-hover)] hover:text-white'
                        }`}
                      >
                        {isMessagePending ? 'Sending…' : 'Message Detailer'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[color:var(--x-border)] bg-black/20 py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(29,155,240,0.35)] bg-[rgba(29,155,240,0.1)]">
                  <svg className="h-8 w-8 text-[color:var(--x-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">{emptyState.title}</h3>
                <p className="mt-2 max-w-sm text-sm text-[color:var(--x-text-secondary)]">{emptyState.description}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default SalespersonDashboard;
