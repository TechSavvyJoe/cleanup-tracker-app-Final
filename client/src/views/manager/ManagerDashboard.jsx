import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { V2 } from '../../utils/v2Client';
import { useToast } from '../../components/Toast';
import { DonutChart, PerformanceChart, Sparkline } from '../../components/DataVisualization';
import LiveTimer from '../../components/LiveTimer';
import DateUtils from '../../utils/dateUtils';

const METRIC_ACCENTS = {
	blue: 'bg-[color:var(--x-blue)]',
	green: 'bg-[color:var(--x-green)]',
	amber: 'bg-[#f1a01f]',
	purple: 'bg-[#9b59ff]',
	red: 'bg-[color:var(--x-red)]',
	slate: 'bg-[color:var(--x-text-secondary)]'
};

const TEAM_DONUT_COLORS = ['#38bdf8', '#6366f1', '#a855f7', '#22d3ee', '#14b8a6', '#f97316', '#facc15', '#f472b6'];

const normalizeStatus = (status) => (status || '').toLowerCase();

const isActiveStatus = (status) => {
	const normalized = normalizeStatus(status);
	return ['in progress', 'in_progress', 'pending', 'active', 'assigned', 'started'].includes(normalized);
};

const isCompletedStatus = (status) => {
	const normalized = normalizeStatus(status);
	return ['completed', 'complete', 'done', 'finished'].includes(normalized);
};

const isQcStatus = (status) => {
	const normalized = normalizeStatus(status);
	return ['qc required', 'qc_required', 'qc pending', 'pending qc', 'needs qc', 'quality control'].includes(normalized);
};

const getStatusMeta = (status) => {
	const normalized = normalizeStatus(status);

	if (['in progress', 'in_progress', 'pending', 'active', 'started'].includes(normalized)) {
		return {
			label: 'In Progress',
			className: 'status-pill bg-[rgba(29,155,240,0.12)] text-[color:var(--x-blue)] border-[rgba(29,155,240,0.35)]'
		};
	}

	if (['completed', 'complete', 'done', 'finished'].includes(normalized)) {
		return {
			label: 'Completed',
			className: 'status-pill bg-[rgba(0,186,124,0.12)] text-[color:var(--x-green)] border-[rgba(0,186,124,0.4)]'
		};
	}

	if (['qc required', 'qc_required', 'qc pending', 'pending qc', 'needs qc', 'quality control'].includes(normalized)) {
		return {
			label: 'QC Review',
			className: 'status-pill bg-[rgba(250,130,49,0.12)] text-[#f1a01f] border-[rgba(250,130,49,0.35)]'
		};
	}

	if (['failed qc', 'rejected', 'issue', 'error'].includes(normalized)) {
		return {
			label: 'Attention',
			className: 'status-pill bg-[rgba(244,33,46,0.12)] text-[color:var(--x-red)] border-[rgba(244,33,46,0.35)]'
		};
	}

	return {
		label: status || 'Unknown',
		className: 'status-pill bg-[rgba(139,152,165,0.12)] text-[color:var(--x-text-secondary)] border-[rgba(139,152,165,0.3)]'
	};
};

const getStartTimestamp = (job = {}) => job.startTime || job.startedAt || job.started_at || job.start_date || job.assignedAt || job.assigned_at;

const getCompletedTimestamp = (job = {}) => job.completedAt || job.completed_at || job.completedDate || job.completed || job.finishTime || job.finishedAt;

const getCreatedTimestamp = (job = {}) => job.date || job.createdAt || job.created_at || job.timestamp;

const toIsoDateKey = (value) => {
	const date = DateUtils.getValidDate(value);
	return date ? date.toISOString().slice(0, 10) : null;
};

const toTimestamp = (value) => {
	const date = DateUtils.getValidDate(value);
	return date ? date.getTime() : 0;
};

const calculateAverageMinutes = (jobs = []) => {
	if (!jobs.length) return 0;
	const durations = jobs
		.map(job => DateUtils.calculateDuration(getStartTimestamp(job), getCompletedTimestamp(job)))
		.filter(duration => duration > 0);
	if (!durations.length) return 0;
	const total = durations.reduce((sum, value) => sum + value, 0);
	return Math.round(total / durations.length);
};

const formatMinutesForDisplay = (minutes) => {
	if (!minutes || Number.isNaN(minutes)) return '—';
	const safeMinutes = Math.max(0, Math.floor(minutes));
	const hours = Math.floor(safeMinutes / 60);
	const remaining = safeMinutes % 60;
	if (hours === 0) return `${remaining}m`;
	if (remaining === 0) return `${hours}h`;
	return `${hours}h ${remaining}m`;
};

const MetricCard = ({ label, value, subLabel, accent = 'blue' }) => {
	const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
	return (
		<div className="x-card x-fade-in x-card--compact space-y-2">
			<div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--x-text-secondary)]">
				<span>{label}</span>
				<span className={`h-2 w-2 rounded-full ${METRIC_ACCENTS[accent] || METRIC_ACCENTS.blue}`}></span>
			</div>
			<div className="text-2xl font-semibold text-[color:var(--x-text-primary)]">{displayValue}</div>
			{subLabel ? <p className="text-xs x-text-subtle">{subLabel}</p> : null}
		</div>
	);
};

const SectionCard = ({ title, action, children, className = '' }) => (
	<section className={`x-card x-fade-in space-y-4 ${className}`}>
		<div className="flex items-center justify-between gap-3">
			<h3 className="x-subtitle">{title}</h3>
			{action || null}
		</div>
		{children}
	</section>
);

const ManagerDashboard = memo(function ManagerDashboard({ jobs, users, currentUser, onRefresh, dashboardStats }) {
	const [selectedJob, setSelectedJob] = useState(null);
	const [jobDetails, setJobDetails] = useState(null);
	const [detailsError, setDetailsError] = useState('');
	const [detailsLoading, setDetailsLoading] = useState(false);
	const [dateFilter, setDateFilter] = useState('today');
	const [autoRefresh, setAutoRefresh] = useState(true);
	const toast = useToast();

	useEffect(() => {
		if (!autoRefresh || selectedJob) return undefined;
		const intervalId = setInterval(() => {
			onRefresh?.();
		}, 30000);
		return () => clearInterval(intervalId);
	}, [autoRefresh, onRefresh, selectedJob]);

	const jobsList = useMemo(() => {
		if (Array.isArray(jobs)) return jobs;
		if (jobs && typeof jobs === 'object') return Object.values(jobs);
		return [];
	}, [jobs]);

	const filteredJobs = useMemo(() => {
		if (!jobsList.length) return [];
		return jobsList.filter(job => {
			if (dateFilter === 'all') return true;
			const candidate = getStartTimestamp(job) || getCompletedTimestamp(job) || getCreatedTimestamp(job);
			if (!candidate) return false;
			if (dateFilter === 'today') return DateUtils.isToday(candidate);
			if (dateFilter === 'week') return DateUtils.isThisWeek(candidate);
			if (dateFilter === 'month') return DateUtils.isThisMonth(candidate);
			return true;
		});
	}, [jobsList, dateFilter]);

	const activeJobs = useMemo(
		() => filteredJobs.filter(job => isActiveStatus(job.status)),
		[filteredJobs]
	);

	const completedJobs = useMemo(
		() => filteredJobs.filter(job => isCompletedStatus(job.status)),
		[filteredJobs]
	);

	const qcJobs = useMemo(
		() => filteredJobs.filter(job => isQcStatus(job.status)),
		[filteredJobs]
	);

	const overdueJobs = useMemo(() => {
		const nowIso = new Date().toISOString();
		return activeJobs.filter(job => {
			const startTime = getStartTimestamp(job);
			if (!startTime) return false;
			return DateUtils.calculateDuration(startTime, nowIso) > 120;
		});
	}, [activeJobs]);

	const detailerCount = useMemo(() => {
		const roster = users && typeof users === 'object' ? Object.values(users) : [];
		return roster.filter(member => (member?.role || '').toLowerCase().includes('detailer')).length;
	}, [users]);

	const onShiftCount = useMemo(() => {
		const techs = new Set();
		activeJobs.forEach(job => {
			if (job.technicianId) {
				techs.add(job.technicianId);
			} else if (job.technicianName) {
				techs.add(job.technicianName);
			}
		});
		return techs.size;
	}, [activeJobs]);

	const todayCompletedJobs = useMemo(
		() => completedJobs.filter(job => DateUtils.isToday(getCompletedTimestamp(job))),
		[completedJobs]
	);

	const weekCompletedJobs = useMemo(
		() => completedJobs.filter(job => DateUtils.isThisWeek(getCompletedTimestamp(job))),
		[completedJobs]
	);

	const todayCompletedCount = todayCompletedJobs.length;
	const weekCompletedCount = weekCompletedJobs.length;
	const averageTodayMinutes = calculateAverageMinutes(todayCompletedJobs);
	const averageWeekMinutes = calculateAverageMinutes(weekCompletedJobs);

	const completionsByDay = useMemo(() => {
		const map = new Map();
		completedJobs.forEach(job => {
			const key = toIsoDateKey(getCompletedTimestamp(job));
			if (!key) return;
			map.set(key, (map.get(key) || 0) + 1);
		});
		return map;
	}, [completedJobs]);

	const performanceSeries = useMemo(() => {
		const series = [];
		for (let i = 6; i >= 0; i -= 1) {
			const day = new Date();
			day.setDate(day.getDate() - i);
			const key = day.toISOString().slice(0, 10);
			const label = day.toLocaleDateString('en-US', { weekday: 'short' });
			series.push({ label, value: completionsByDay.get(key) || 0 });
		}
		return series;
	}, [completionsByDay]);

	const sparklineData = useMemo(() => performanceSeries.map(point => point.value), [performanceSeries]);

	const teamDonutData = useMemo(() => {
		const counts = new Map();
		completedJobs.forEach(job => {
			const owner = job.technicianName || job.assignedTo || 'Unassigned';
			counts.set(owner, (counts.get(owner) || 0) + 1);
		});
		const entries = Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, TEAM_DONUT_COLORS.length);

		return entries.map(([label, value], index) => ({
			label,
			value,
			color: TEAM_DONUT_COLORS[index % TEAM_DONUT_COLORS.length]
		}));
	}, [completedJobs]);

	const efficiencyScore = useMemo(() => {
		const denominator = activeJobs.length + completedJobs.length;
		if (!denominator) return 0;
		return Math.round((completedJobs.length / denominator) * 100);
	}, [activeJobs.length, completedJobs.length]);

	const activePreview = useMemo(() => {
		const sorted = [...activeJobs];
		sorted.sort((a, b) => toTimestamp(getStartTimestamp(b)) - toTimestamp(getStartTimestamp(a)));
		return sorted.slice(0, 6);
	}, [activeJobs]);

	const completedPreview = useMemo(() => {
		const sorted = [...completedJobs];
		sorted.sort((a, b) => toTimestamp(getCompletedTimestamp(b)) - toTimestamp(getCompletedTimestamp(a)));
		return sorted.slice(0, 6);
	}, [completedJobs]);

	const qcPreview = useMemo(() => {
		const sorted = [...qcJobs];
		sorted.sort((a, b) => toTimestamp(getCompletedTimestamp(b)) - toTimestamp(getCompletedTimestamp(a)));
		return sorted.slice(0, 6);
	}, [qcJobs]);

	const openJobDetails = useCallback(async (job) => {
		setSelectedJob(job);
		setDetailsError('');
		setDetailsLoading(true);
		setJobDetails(null);
		try {
			const jobId = job?.id || job?._id;
			if (!jobId) throw new Error('Job ID not found');
			const res = await V2.get(`/jobs/${jobId}`);
			setJobDetails(res.data || null);
		} catch (err) {
			setDetailsError(err.response?.data?.error || err.message || 'Unable to load job details');
		} finally {
			setDetailsLoading(false);
		}
	}, []);

	const closeJobDetails = useCallback(() => {
		setSelectedJob(null);
		setJobDetails(null);
		setDetailsError('');
	}, []);

	const performJobAction = useCallback(async (action) => {
		const detailJob = jobDetails?.job || jobDetails || selectedJob;
		const jobId = detailJob?.id || detailJob?._id;
		if (!jobId) {
			toast.error('Job ID not found');
			return;
		}
		try {
			let message = '';
			if (action === 'start') {
				await V2.put(`/jobs/${jobId}/start`, { userId: currentUser?.id });
				message = 'Timer started successfully';
			} else if (action === 'stop') {
				const sessions = (detailJob?.technicianSessions || []).filter(
					(session) => session && (!session.endTime)
				);
				if (!sessions.length && currentUser?.id) {
					await V2.post(`/jobs/${jobId}/remove-technician`, {
						technicianId: currentUser.id,
						endTime: new Date().toISOString()
					});
				} else {
					await Promise.all(
						sessions.map((session) =>
							V2.post(`/jobs/${jobId}/remove-technician`, {
								technicianId: session.technicianId,
								endTime: new Date().toISOString()
							})
						)
					);
				}
				message = 'Active technician timers stopped';
			} else if (action === 'complete') {
				await V2.put(`/jobs/${jobId}/complete`, { userId: currentUser?.id, completedAt: new Date().toISOString() });
				message = 'Job marked complete';
			} else if (action === 'qc') {
				await V2.put(`/jobs/${jobId}/status`, { status: 'QC Required' });
				message = 'Sent to QC';
			}
			await onRefresh?.();
			closeJobDetails();
			if (message) toast.success(message);
		} catch (err) {
			toast.error(err.response?.data?.error || err.message || 'Action failed');
		}
	}, [jobDetails, selectedJob, currentUser?.id, onRefresh, closeJobDetails, toast]);

	const metricCards = useMemo(() => ([
		{
			label: 'ACTIVE',
			value: activeJobs.length,
			subLabel: `${onShiftCount || 0} tech${onShiftCount === 1 ? '' : 's'} on shift`,
			accent: 'blue'
		},
		{
			label: 'COMPLETED TODAY',
			value: todayCompletedCount,
			subLabel: `Avg ${formatMinutesForDisplay(averageTodayMinutes)}`,
			accent: 'green'
		},
		{
			label: 'QC PENDING',
			value: qcJobs.length,
			subLabel: qcJobs.length ? 'Awaiting review' : 'All clear',
			accent: 'amber'
		},
		{
			label: 'WEEK COMPLETED',
			value: weekCompletedCount,
			subLabel: `${dashboardStats?.totalCompleted ?? completedJobs.length} total`,
			accent: 'purple'
		},
		{
			label: 'OVERDUE',
			value: overdueJobs.length,
			subLabel: overdueJobs.length ? 'Over 2h active' : 'No lag',
			accent: 'red'
		},
		{
			label: 'TEAM',
			value: detailerCount,
			subLabel: `${jobsList.length} jobs in scope`,
			accent: 'slate'
		}
	]), [
		activeJobs.length,
		onShiftCount,
		todayCompletedCount,
		averageTodayMinutes,
		qcJobs.length,
		weekCompletedCount,
		dashboardStats?.totalCompleted,
		completedJobs.length,
		overdueJobs.length,
		detailerCount,
		jobsList.length
	]);

	const lastUpdated = DateUtils.formatDate(new Date(), { hour: '2-digit', minute: '2-digit' });
	const timeframeOptions = [
		{ key: 'today', label: 'Today' },
		{ key: 'week', label: 'Week' },
		{ key: 'month', label: 'Month' },
		{ key: 'all', label: 'All' }
	];

	const detailJob = jobDetails?.job || jobDetails || selectedJob || {};
	const detailEvents = (jobDetails?.events || detailJob?.events || []).filter(event => event?.type);

	return (
		<div className="space-y-8 text-[color:var(--x-text-primary)]">
			<header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="space-y-1">
					<h2 className="text-2xl font-semibold">Operations Command</h2>
					<p className="text-sm x-text-subtle">
						{filteredJobs.length} jobs in view • updated {lastUpdated}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--x-border)] bg-[color:var(--x-surface-elevated)] p-1">
						{timeframeOptions.map(option => (
							<button
								key={option.key}
								onClick={() => setDateFilter(option.key)}
								type="button"
								className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
									dateFilter === option.key
										? 'bg-[color:var(--x-blue)] text-black'
										: 'text-[color:var(--x-text-secondary)] hover:text-[color:var(--x-text-primary)]'
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
					<button
						onClick={() => setAutoRefresh(prev => !prev)}
						type="button"
						className={`x-button text-xs ${autoRefresh ? 'x-button--accent' : 'x-button--secondary'}`}
					>
						{autoRefresh ? 'Auto On' : 'Auto Off'}
					</button>
					<button
						onClick={() => onRefresh?.()}
						type="button"
						className="x-button x-button--secondary"
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						Refresh
					</button>
				</div>
			</header>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
				{metricCards.map(card => (
					<MetricCard key={card.label} {...card} />
				))}
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<SectionCard
					title="PERFORMANCE TREND"
					className="xl:col-span-2 x-card--premium"
					action={<span className="text-xs x-text-subtle">Last 7 days</span>}
				>
					<PerformanceChart data={performanceSeries} height={220} color="#38bdf8" showGrid />
					<div className="mt-4 grid grid-cols-2 gap-4 text-xs x-text-subtle lg:grid-cols-4">
						<div className="flex items-center justify-between gap-2">
							<span>Avg today</span>
							<span className="font-semibold text-[color:var(--x-text-primary)]">{formatMinutesForDisplay(averageTodayMinutes)}</span>
						</div>
						<div className="flex items-center justify-between gap-2">
							<span>Avg week</span>
							<span className="font-semibold text-[color:var(--x-text-primary)]">{formatMinutesForDisplay(averageWeekMinutes)}</span>
						</div>
						<div className="flex items-center justify-between gap-2">
							<span>Efficiency</span>
							<span className="font-semibold text-[color:var(--x-text-primary)]">{efficiencyScore ? `${efficiencyScore}%` : '—'}</span>
						</div>
						<div className="flex items-center justify-between gap-2">
							<span>Active vs Done</span>
							<span className="font-semibold text-[color:var(--x-text-primary)]">{activeJobs.length}:{completedJobs.length}</span>
						</div>
					</div>
				</SectionCard>

				<SectionCard
					title="TEAM DISTRIBUTION"
					action={<span className="text-xs x-text-subtle">Top performers</span>}
				>
					<div className="flex flex-col items-center gap-4">
						<DonutChart data={teamDonutData} size={200} centerText="Jobs" />
						<div className="w-full">
							<Sparkline data={sparklineData} width={220} height={48} color="#a855f7" />
							<p className="mt-2 text-xs x-text-subtle">Completions per day</p>
						</div>
						<div className="w-full space-y-1 text-xs x-text-subtle">
							{teamDonutData.slice(0, 3).map(entry => (
								<div key={entry.label} className="flex items-center justify-between">
									<span>{entry.label}</span>
									<span className="font-semibold text-[color:var(--x-text-primary)]">{entry.value}</span>
								</div>
							))}
							{!teamDonutData.length ? (
								<p className="text-xs x-text-subtle">No completions recorded yet.</p>
							) : null}
						</div>
					</div>
				</SectionCard>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<SectionCard
					title="ACTIVE JOBS"
					action={<span className="text-xs x-text-subtle">{activeJobs.length} total</span>}
				>
					<div className="space-y-3">
						{activePreview.length ? (
							activePreview.map(job => {
								const meta = getStatusMeta(job.status);
								return (
									<button
										key={job.id || job._id}
										onClick={() => openJobDetails(job)}
										type="button"
										className="job-card w-full text-left"
									>
										<div className="flex flex-col gap-2">
											<div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
												<span>{job.year} {job.make} {job.model}</span>
												{job.vehicleColor ? <span className="x-badge">{job.vehicleColor}</span> : null}
												<span className={meta.className}>{meta.label}</span>
											</div>
											<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs x-text-subtle">
												<span>Stock <span className="text-[color:var(--x-text-primary)]">{job.stockNumber || 'N/A'}</span></span>
												<span>VIN <span className="font-mono text-[color:var(--x-text-primary)]">{job.vin?.slice(-8) || 'N/A'}</span></span>
												<span>Service <span className="text-[color:var(--x-blue)]">{job.serviceType || 'N/A'}</span></span>
												<span>Tech <span className="text-[color:var(--x-text-primary)]">{job.technicianName || job.assignedTo || 'N/A'}</span></span>
											</div>
										</div>
										<div className="text-right text-sm">
											{getStartTimestamp(job) ? (
												<>
													<LiveTimer
														startTime={getStartTimestamp(job)}
														className="font-semibold text-[color:var(--x-blue)]"
													/>
													<p className="text-[10px] uppercase tracking-[0.18em] x-text-subtle">Live</p>
												</>
											) : (
												<p className="x-text-subtle">Awaiting start</p>
											)}
										</div>
									</button>
								);
							})
						) : (
							<div className="x-banner text-center text-sm">No active jobs right now.</div>
						)}
					</div>
				</SectionCard>

				<SectionCard
					title="RECENT COMPLETIONS"
					action={<span className="text-xs x-text-subtle">{completedJobs.length} in range</span>}
				>
					<div className="space-y-3">
						{completedPreview.length ? (
							completedPreview.map(job => {
								const meta = getStatusMeta(job.status);
								const startTime = getStartTimestamp(job);
								const completedAt = getCompletedTimestamp(job);
								const duration = startTime && completedAt
									? formatMinutesForDisplay(DateUtils.calculateDuration(startTime, completedAt))
									: '—';
								return (
									<button
										key={job.id || job._id}
										onClick={() => openJobDetails(job)}
										type="button"
										className="job-card w-full text-left"
									>
										<div className="flex flex-col gap-2">
											<div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
												{job.year} {job.make} {job.model}
												<span className={meta.className}>{meta.label}</span>
											</div>
											<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs x-text-subtle">
												<span>Stock <span className="text-[color:var(--x-text-primary)]">{job.stockNumber || 'N/A'}</span></span>
												<span>Service <span className="text-[color:var(--x-green)]">{job.serviceType || 'N/A'}</span></span>
												<span>Completed <span className="text-[color:var(--x-text-primary)]">{DateUtils.formatDateTime(completedAt)}</span></span>
											</div>
										</div>
										<div className="text-right">
											<p className="text-lg font-semibold text-[color:var(--x-green)]">{duration}</p>
											<p className="text-[10px] uppercase tracking-[0.18em] x-text-subtle">Cycle time</p>
										</div>
									</button>
								);
							})
						) : (
							<div className="x-banner text-center text-sm">No completions in this window.</div>
						)}
					</div>
				</SectionCard>
			</div>

			<SectionCard
				title="QUALITY CONTROL"
				action={
					<span className={`text-xs font-semibold uppercase tracking-[0.18em] ${qcJobs.length ? 'text-[#f1a01f]' : 'x-text-subtle'}`}>
						{qcJobs.length ? `${qcJobs.length} waiting` : 'All clear'}
					</span>
				}
			>
				<div className="space-y-3">
					{qcPreview.length ? (
						qcPreview.map(job => {
							const meta = getStatusMeta(job.status);
							const completedAt = getCompletedTimestamp(job);
							return (
								<button
									key={job.id || job._id}
									onClick={() => openJobDetails(job)}
									type="button"
									className="job-card w-full text-left"
								>
									<div className="flex flex-col gap-2">
										<div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
											{job.year} {job.make} {job.model}
											<span className={meta.className}>{meta.label}</span>
										</div>
										<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs x-text-subtle">
											<span>Stock <span className="text-[color:var(--x-text-primary)]">{job.stockNumber || 'N/A'}</span></span>
											<span>Tech <span className="text-[color:var(--x-text-primary)]">{job.technicianName || 'N/A'}</span></span>
											<span>Completed <span className="text-[color:var(--x-text-primary)]">{DateUtils.formatDateTime(completedAt)}</span></span>
										</div>
									</div>
									<div className="text-right">
										<span className="status-pill bg-[rgba(250,130,49,0.12)] text-[#f1a01f] border-[rgba(250,130,49,0.35)]">
											Review
										</span>
									</div>
								</button>
							);
						})
					) : (
						<div className="x-banner text-center text-sm">No jobs awaiting QC.</div>
					)}
				</div>
			</SectionCard>

			{selectedJob ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
					<div className="relative w-full max-w-4xl x-card x-card--surface x-fade-in space-y-6">
						<button
							onClick={closeJobDetails}
							type="button"
							className="absolute right-4 top-4 x-button x-button--muted px-3 py-1 text-xs"
						>
							Close
						</button>

						<div className="pr-6">
					<p className="text-[11px] uppercase tracking-[0.32em] x-text-subtle">Job Overview</p>
					<h2 className="mt-2 text-xl font-semibold">
						{selectedJob?.vehicleSummary || selectedJob?.vehicle?.summary || [selectedJob?.year, selectedJob?.make, selectedJob?.model].filter(Boolean).join(' ') || 'Vehicle'}
					</h2>
					<div className="mt-2 flex flex-wrap gap-3 text-xs x-text-subtle">
						<span>Stock <span className="text-[color:var(--x-text-primary)]">{selectedJob?.vehicle?.stockNumber || selectedJob?.stockNumber || 'N/A'}</span></span>
						<span>VIN <span className="font-mono text-[color:var(--x-text-primary)]">{selectedJob?.vehicle?.vin || selectedJob?.vin || 'N/A'}</span></span>
						<span>Service <span className="text-[color:var(--x-blue)]">{selectedJob?.serviceType || 'N/A'}</span></span>
						<span>Tech <span className="text-[color:var(--x-text-primary)]">{selectedJob?.technicianName || 'N/A'}</span></span>
					</div>
						</div>

						{detailsLoading ? (
							<div className="py-16 text-center text-sm x-text-subtle">Loading details…</div>
						) : (
							<>
								{detailsError ? (
									<div className="mt-4 x-banner text-[color:var(--x-red)]">{detailsError}</div>
								) : null}

								<div className="mt-6 grid gap-4 md:grid-cols-2">
									<div className="space-y-3">
										<h3 className="text-xs font-semibold uppercase tracking-[0.28em] x-text-subtle">Vehicle</h3>
						<dl className="space-y-2 text-sm x-text-subtle">
							<div className="flex justify-between">
								<dt>Vehicle</dt>
								<dd className="text-[color:var(--x-text-primary)] text-right">
									{detailJob?.vehicleSummary || detailJob?.vehicle?.summary || detailJob?.vehicleDescription || 'N/A'}
								</dd>
							</div>
							<div className="flex justify-between">
								<dt>Stock</dt>
								<dd className="text-[color:var(--x-text-primary)]">{detailJob?.vehicle?.stockNumber || detailJob?.stockNumber || 'N/A'}</dd>
							</div>
							<div className="flex justify-between">
								<dt>VIN</dt>
								<dd className="font-mono text-[color:var(--x-text-primary)] text-xs">{detailJob?.vehicle?.vin || detailJob?.vin || 'N/A'}</dd>
							</div>
											<div className="flex justify-between">
												<dt>Service</dt>
												<dd className="text-[color:var(--x-blue)]">{detailJob?.serviceType || 'N/A'}</dd>
											</div>
							<div className="flex justify-between">
								<dt>Sales</dt>
								<dd className="text-[color:var(--x-green)]">{detailJob?.salesPerson || '—'}</dd>
							</div>
							<div className="flex justify-between">
								<dt>Color</dt>
								<dd className="text-[color:var(--x-text-primary)]">{detailJob?.vehicle?.color || detailJob?.vehicleColor || '—'}</dd>
							</div>
							<div className="flex justify-between">
								<dt>Priority</dt>
								<dd className="text-[color:var(--x-text-primary)]">{detailJob?.priority || 'Normal'}</dd>
							</div>
						</dl>
					</div>

									<div className="space-y-3">
										<h3 className="text-xs font-semibold uppercase tracking-[0.28em] x-text-subtle">Timing</h3>
										<dl className="space-y-2 text-sm x-text-subtle">
											<div className="flex items-center justify-between">
												<dt>Status</dt>
												<dd>
													<span className={getStatusMeta(detailJob?.status).className}>
														{getStatusMeta(detailJob?.status).label}
													</span>
												</dd>
											</div>
											<div className="flex justify-between">
												<dt>Created</dt>
												<dd className="text-[color:var(--x-text-primary)]">{DateUtils.formatDateTime(detailJob?.date)}</dd>
											</div>
											<div className="flex justify-between">
												<dt>Started</dt>
												<dd className="text-[color:var(--x-text-primary)]">{DateUtils.formatDateTime(getStartTimestamp(detailJob))}</dd>
											</div>
											<div className="flex justify-between">
												<dt>Completed</dt>
												<dd className="text-[color:var(--x-text-primary)]">{DateUtils.formatDateTime(getCompletedTimestamp(detailJob))}</dd>
											</div>
										</dl>
										{isActiveStatus(detailJob?.status) && getStartTimestamp(detailJob) ? (
											<div className="x-banner text-center">
												<p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--x-blue)]">Live timer</p>
												<LiveTimer
													startTime={getStartTimestamp(detailJob)}
													className="text-xl font-semibold text-[color:var(--x-blue)]"
												/>
											</div>
										) : null}
										{isCompletedStatus(detailJob?.status) && getStartTimestamp(detailJob) && getCompletedTimestamp(detailJob) ? (
											<div className="x-banner text-center">
												<p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--x-green)]">Total time</p>
												<p className="text-xl font-semibold text-[color:var(--x-green)]">
													{formatMinutesForDisplay(
														DateUtils.calculateDuration(getStartTimestamp(detailJob), getCompletedTimestamp(detailJob))
													)}
												</p>
											</div>
										) : null}
									</div>
								</div>

								<div className="space-y-3">
									<h3 className="text-xs font-semibold uppercase tracking-[0.28em] x-text-subtle">Timeline</h3>
									<div className="max-h-48 overflow-y-auto">
										<ul className="space-y-2 text-sm x-text-subtle">
											{detailEvents.map((eventItem, index) => (
												<li key={`${eventItem.type}-${index}`} className="flex items-center justify-between gap-4">
													<div>
														<span className="text-[color:var(--x-text-primary)]">{eventItem.type}</span>
														{eventItem.userName ? (
															<span className="ml-2 text-xs x-text-subtle">{eventItem.userName}</span>
														) : null}
													</div>
													<span className="text-xs x-text-subtle">{DateUtils.formatDateTime(eventItem.timestamp)}</span>
												</li>
											))}
											{!detailEvents.length ? (
												<li className="py-4 text-center text-sm x-text-subtle">No timeline entries yet.</li>
											) : null}
										</ul>
									</div>
								</div>

								<div className="flex flex-wrap gap-2">
									<button onClick={() => performJobAction('start')} type="button" className="x-button x-button--accent">
										Start Timer
									</button>
									<button onClick={() => performJobAction('stop')} type="button" className="x-button x-button--secondary">
										Stop Timer
									</button>
									<button onClick={() => performJobAction('complete')} type="button" className="x-button">
										Mark Complete
									</button>
									<button onClick={() => performJobAction('qc')} type="button" className="x-button x-button--danger">
										Send to QC
									</button>
								</div>
							</>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
});

ManagerDashboard.propTypes = {
	jobs: PropTypes.oneOfType([
		PropTypes.arrayOf(PropTypes.shape({
			id: PropTypes.string,
			_id: PropTypes.string,
			status: PropTypes.string,
			vin: PropTypes.string,
			stockNumber: PropTypes.string,
			vehicleDescription: PropTypes.string,
			make: PropTypes.string,
			model: PropTypes.string,
			year: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
			serviceType: PropTypes.string,
			technicianName: PropTypes.string,
			technicianId: PropTypes.string,
			salesPerson: PropTypes.string,
			priority: PropTypes.string,
			startTime: PropTypes.string,
			startedAt: PropTypes.string,
			completedAt: PropTypes.string,
			date: PropTypes.string,
			createdAt: PropTypes.string,
			assignedTo: PropTypes.string
		})),
		PropTypes.object
	]).isRequired,
	users: PropTypes.object,
	currentUser: PropTypes.shape({
		id: PropTypes.string,
		name: PropTypes.string,
		role: PropTypes.string
	}),
	onRefresh: PropTypes.func,
	dashboardStats: PropTypes.shape({
		totalCompleted: PropTypes.number
	})
};

ManagerDashboard.displayName = 'ManagerDashboard';

export default ManagerDashboard;
