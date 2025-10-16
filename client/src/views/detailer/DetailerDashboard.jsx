import React, { useState, useEffect, useMemo } from 'react';
import { V2 } from '../../utils/v2Client';
import { GlassCard, ProgressRing } from '../../components/PremiumUI';
import { Sparkline } from '../../components/DataVisualization';
import LiveTimer from '../../components/LiveTimer';
import DateUtils from '../../utils/dateUtils';

function DetailerDashboard({ user, jobs, completedJobs, userActiveJob, onStopWork, onOpenScanner, onGoToNewJob }) {
  const [showStats, setShowStats] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterServiceType, setFilterServiceType] = useState('');

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (!completedJobs || !Array.isArray(completedJobs)) return {
      todayJobs: 0,
      weekJobs: 0,
      monthJobs: 0,
      avgTime: 0,
      efficiency: 0
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const myJobs = completedJobs.filter(j =>
      j.assignedTechnicianIds?.includes(user.id) ||
      j.technicianId === user.id ||
      j.technicianId === user.pin
    );

    const todayJobs = myJobs.filter(j => {
      const jobDate = new Date(j.date || j.completedAt || j.startTime || j.createdAt);
      return jobDate >= today;
    });

    const weekJobs = myJobs.filter(j => {
      const jobDate = new Date(j.date || j.completedAt || j.startTime || j.createdAt);
      return jobDate >= weekAgo;
    });

    const monthJobs = myJobs.filter(j => {
      const jobDate = new Date(j.date || j.completedAt || j.startTime || j.createdAt);
      return jobDate >= monthAgo;
    });

    const totalTime = todayJobs.reduce((sum, job) => sum + (job.duration || 0), 0);
    const avgTime = todayJobs.length > 0 ? Math.round(totalTime / todayJobs.length) : 0;

    // Calculate efficiency (jobs per hour)
    const efficiency = todayJobs.length > 0 && totalTime > 0 ?
      Math.round((todayJobs.length / (totalTime / 60)) * 10) / 10 : 0;

    return {
      todayJobs: todayJobs.length,
      weekJobs: weekJobs.length,
      monthJobs: monthJobs.length,
      avgTime,
      efficiency,
      recentJobs: todayJobs.slice(-5).reverse()
    };
  }, [completedJobs, user.id, user.pin]);

  // Extract today's job count for easy access
  const myJobsToday = performanceMetrics.todayJobs;

  const [details, setDetails] = useState(null);
  const [elapsed, setElapsed] = useState(0); // seconds

  const completeJob = async (status) => {
    try {
      // Use the same completion logic but with different status
      if (status === 'qc_required') {
        await V2.put(`/jobs/${userActiveJob.id}/status`, { status: 'QC Required' });
      } else {
        await V2.put(`/jobs/${userActiveJob.id}/status`, { status: 'Completed' });
      }
      onStopWork(); // This will refresh the data
    } catch (error) {
      console.error('Failed to complete job:', error);
      alert('Failed to complete job: ' + (error.response?.data?.error || error.message));
    }
  };

  // Job details modal state
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);

  // Job action handler
  const handleJobAction = async (action) => {
    try {
      const jobId = userActiveJob?.id || userActiveJob?._id;
      if (!jobId) return alert('No active job found');

      switch (action) {
        case 'pause':
          await V2.post(`/jobs/${jobId}/pause`);
          alert('Job paused successfully');
          break;
        case 'addTechnician':
          const techId = prompt('Enter technician ID or scan their badge:');
          if (techId) {
            await V2.post(`/jobs/${jobId}/add-technician`, { technicianId: techId });
            alert('Technician added successfully');
          }
          break;
        case 'message':
          const message = prompt('Enter your message:');
          if (message) {
            await V2.post(`/jobs/${jobId}/message`, {
              message,
              fromUserId: user.id,
              fromUserName: user.name
            });
            alert('Message sent successfully');
          }
          break;
        default:
          break;
      }
    } catch (err) {
      alert('Action failed: ' + (err.response?.data?.error || err.message));
    }
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Open job details handler
  const openJobDetails = async (job) => {
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

  const closeJobDetails = () => {
    setSelectedJob(null);
    setJobDetails(null);
    setError('');
  };

  // Handle priority change
  const handlePriorityChange = async (newPriority) => {
    if (!jobDetails?.job?.id) return;
    try {
      await V2.patch(`/jobs/${jobDetails.job.id}`, { priority: newPriority });
      setJobDetails(prev => ({
        ...prev,
        job: { ...prev.job, priority: newPriority }
      }));
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  // Handle sales person change
  const handleSalesPersonChange = async (newSalesPerson) => {
    if (!jobDetails?.job?.id) return;
    try {
      await V2.patch(`/jobs/${jobDetails.job.id}`, { salesPerson: newSalesPerson });
      setJobDetails(prev => ({
        ...prev,
        job: { ...prev.job, salesPerson: newSalesPerson }
      }));
    } catch (err) {
      console.error('Failed to update sales person:', err);
    }
  };

  // Fetch details for active job and run timer
  useEffect(() => {
    let interval;
    const fetchAndStart = async () => {
      if (!userActiveJob) {
        setDetails(null);
        setElapsed(0);
        return;
      }

      try {
        const res = await V2.get(`/jobs/${userActiveJob.id}`);
        setDetails(res.data);

        // Get start time from multiple possible sources
        const startTime = userActiveJob.startTime || userActiveJob.startedAt ||
                         res.data?.job?.startTime || res.data?.job?.startedAt ||
                         res.data?.job?.createdAt;

        let startTs;
        if (startTime && DateUtils.isValidDate(startTime)) {
          startTs = new Date(startTime).getTime();
        } else {
          // Fallback to events
          const startEvent = (res.data?.events || []).find(e =>
            e.type?.toLowerCase().includes('start') || e.type?.toLowerCase().includes('created')
          ) || (res.data?.events || [])[0];

          if (startEvent && DateUtils.isValidDate(startEvent.timestamp)) {
            startTs = new Date(startEvent.timestamp).getTime();
          } else {
            startTs = Date.now(); // Ultimate fallback
          }
        }

        const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startTs) / 1000)));
        update();
        interval = setInterval(update, 1000);
      } catch (err) {
        console.error('Failed to fetch job details:', err);
        // Fallback timer using job start time
        if (userActiveJob.startTime && DateUtils.isValidDate(userActiveJob.startTime)) {
          const startTs = new Date(userActiveJob.startTime).getTime();
          const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startTs) / 1000)));
          update();
          interval = setInterval(update, 1000);
        }
      }
    };
    fetchAndStart();
    return () => { if (interval) clearInterval(interval); };
  }, [userActiveJob]);

  // Add error handling for the dashboard after all hooks
  if (!user) {
    return <div className="text-white p-4">Error: No user data found</div>;
  }

  const fmt = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2,'0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2,'0');
    const sec = (s % 60).toString().padStart(2,'0');
    return `${h}:${m}:${sec}`;
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Current Job Status - X.com Style */}
        {userActiveJob ? (
          <div className="bg-black rounded-2xl p-8 border border-gray-800 hover:border-gray-700 transition-all duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white">Current Job</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="md:col-span-2">
                <h4 className="text-3xl font-bold text-white mb-3">{userActiveJob.vehicleDescription}</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/30">
                    <p className="text-blue-400 font-medium text-xs mb-1">Service Type</p>
                    <p className="text-white font-semibold text-sm">{userActiveJob.serviceType}</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/30">
                    <p className="text-purple-400 font-medium text-xs mb-1">Stock Number</p>
                    <p className="text-white font-semibold text-sm">{userActiveJob.stockNumber}</p>
                  </div>
                </div>
                {details && (
                  <div className="bg-black rounded-2xl p-4">
                    <p className="text-gray-600 font-medium text-sm mb-2">
                      Started: {DateUtils.formatDate(
                        (details.job?.startedAt) || (details.events?.[0]?.timestamp) || Date.now(),
                        { hour: '2-digit', minute: '2-digit', second: '2-digit' }
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6">
                {details && (
                  <>
                    <p className="text-amber-600 font-semibold text-sm mb-2">Time Working</p>
                    <p className="text-4xl font-bold text-amber-900 font-mono mb-2">{fmt(elapsed)}</p>
                    <div className="w-full bg-amber-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => handleJobAction('pause')}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 px-4 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] text-sm"
              >
                Pause
              </button>
              <button
                onClick={() => handleJobAction('addTechnician')}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] text-sm"
              >
                Add Helper
              </button>
              <button
                onClick={() => handleJobAction('message')}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] text-sm"
              >
                Message
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <button
                  onClick={() => completeJob('completed')}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                >
                  Complete - Ready for Delivery
                </button>
                <button
                  onClick={() => completeJob('qc_required')}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                >
                  Complete - Needs QC Review
                </button>
              </div>
              {details && (
                <button
                  onClick={() => setShowTimeline(!showTimeline)}
                  className="px-6 py-4 bg-gray-900 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {showTimeline ? 'Hide' : 'Show'} Timeline
                </button>
              )}
            </div>

            {showTimeline && details && (
              <div className="mt-6 bg-black rounded-2xl p-6 border border-gray-800">
                <h5 className="font-bold text-white mb-4">Job Timeline</h5>
                <ul className="space-y-3 max-h-40 overflow-auto">
                  {(details.events || []).map((ev, idx) => (
                    <li key={idx} className="flex items-center gap-3 p-3 bg-black rounded-xl shadow-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <span className="font-semibold text-white">{ev.type}</span>
                        <p className="text-gray-600 text-sm">{DateUtils.formatDate(ev.timestamp)} {ev.userName ? `• ${ev.userName}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-black rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">Start a New Job</h3>
              <button
                onClick={async () => { try { await V2.post('/vehicles/refresh'); alert('Inventory refreshed. Try your search again.'); } catch (e) { alert('Refresh failed: ' + (e.response?.data?.error || e.message)); } }}
                className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 font-medium rounded-full transition-colors text-xs border border-gray-800"
              >
                Refresh
              </button>
            </div>

            <p className="text-gray-400 mb-3 text-xs">Scan a VIN or search by VIN/Stock to begin working.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={onOpenScanner}
                className="group bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-6 px-6 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Scan VIN
              </button>
              <button
                onClick={onGoToNewJob}
                className="group bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-6 px-6 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Vehicle
              </button>
            </div>
          </div>
        )}

        {/* Today's Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black rounded-3xl p-8 shadow-2xl border border-gray-800 transform hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-gray-600 text-sm font-semibold uppercase tracking-wider">Completed Today</h4>
                <p className="text-4xl font-bold text-white">{myJobsToday}</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-2xl p-4">
              <p className="text-green-700 font-semibold text-sm">Great work! Keep it up!</p>
              <div className="mt-2 w-full bg-green-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full" style={{width: Math.min(100, (myJobsToday / 8) * 100) + '%'}}></div>
              </div>
            </div>
          </div>

          <div className="bg-black rounded-3xl p-8 shadow-2xl border border-gray-800 transform hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                userActiveJob
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-blue-400 to-purple-500'
              }`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {userActiveJob ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  )}
                </svg>
              </div>
              <div>
                <h4 className="text-gray-600 text-sm font-semibold uppercase tracking-wider">Active Job</h4>
                <p className="text-4xl font-bold text-white">{userActiveJob ? 1 : 0}</p>
              </div>
            </div>
            <div className={`rounded-2xl p-4 ${
              userActiveJob
                ? 'bg-amber-50'
                : 'bg-blue-50'
            }`}>
              <p className={`font-semibold text-sm ${
                userActiveJob
                  ? 'text-amber-700'
                  : 'text-blue-700'
              }`}>
                {userActiveJob ? 'Keep going! You\'re doing great!' : 'Ready to start your next job'}
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div className={`h-2 rounded-full ${
                  userActiveJob
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse'
                    : 'bg-gradient-to-r from-blue-400 to-purple-500'
                }`} style={{width: userActiveJob ? '100%' : '0%'}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Enterprise Personal Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Efficiency Ring */}
          <GlassCard className="p-3 text-center">
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Personal Efficiency
            </h4>
            <ProgressRing
              progress={Math.min(100, (performanceMetrics.efficiency || 0) * 10)}
              size={120}
              color="#10b981"
              label={`${performanceMetrics.efficiency || 0}/10 Score`}
            />
            <p className="text-sm text-gray-600 mt-2">Based on avg completion time</p>
          </GlassCard>

          {/* Weekly Performance Trend */}
          <GlassCard className="p-3">
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              7-Day Trend
            </h4>
            <Sparkline
              data={(() => {
                // Generate personal performance data for the last 7 days
                const last7Days = Array.from({length: 7}, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (6 - i));
                  const dayJobs = completedJobs.filter(job => {
                    if (!job.completedAt && !job.date) return false;
                    const jobDate = new Date(job.completedAt || job.date);
                    const isMyJob = job.assignedTechnicianIds?.includes(user.id) ||
                                   job.technicianId === user.id ||
                                   job.technicianId === user.pin;
                    return isMyJob && jobDate.toDateString() === date.toDateString();
                  });
                  return dayJobs.length;
                });
                return last7Days;
              })()}
              width={180}
              height={60}
              color="#8b5cf6"
            />
            <div className="mt-2 text-center">
              <p className="text-sm text-gray-600">Jobs completed per day</p>
            </div>
          </GlassCard>

          {/* Achievement Badge */}
          <GlassCard className="p-3">
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Achievement
            </h4>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h5 className="font-bold text-white">
                {myJobsToday >= 5 ? 'Productivity Star' :
                 myJobsToday >= 3 ? 'Consistent Performer' :
                 myJobsToday >= 1 ? 'Getting Started' : 'Ready to Begin'}
              </h5>
              <p className="text-sm text-gray-600 mt-1">
                {myJobsToday >= 5 ? 'Excellent job today!' :
                 myJobsToday >= 3 ? 'Great consistency!' :
                 myJobsToday >= 1 ? 'Keep up the momentum!' : 'Your first job awaits!'}
              </p>
            </div>
          </GlassCard>
        </div>

        {/* My Job History */}
        <div className="bg-black rounded-3xl p-8 shadow-2xl border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white">My Job History & Analytics</h3>
            </div>
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-medium transition-colors"
            >
              {showStats ? 'Hide Stats' : 'Show Stats'}
            </button>
          </div>

          {/* Stats Panel */}
          {showStats && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                <h4 className="text-blue-700 font-semibold mb-1">Total Completed</h4>
                <p className="text-2xl font-bold text-blue-900">
                  {completedJobs.filter(job =>
                    job.technicianId === user.id ||
                    job.technicianName === user.name ||
                    (job.assignedTechnicianIds && job.assignedTechnicianIds.includes(user.id))
                  ).length}
                </p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                <h4 className="text-green-700 font-semibold mb-1">Avg Time/Job</h4>
                <p className="text-2xl font-bold text-green-900">
                  {(() => {
                    const myJobs = completedJobs.filter(job =>
                      (job.technicianId === user.id || job.technicianName === user.name) &&
                      job.duration
                    );
                    if (myJobs.length === 0) return 'N/A';
                    const avgMs = myJobs.reduce((sum, job) => sum + job.duration, 0) / myJobs.length;
                    const hours = Math.floor(avgMs / (1000 * 60 * 60));
                    const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
                    return `${hours}h ${minutes}m`;
                  })()}
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                <h4 className="text-purple-700 font-semibold mb-1">This Week</h4>
                <p className="text-2xl font-bold text-purple-900">
                  {completedJobs.filter(job => {
                    if (!job.completedAt) return false;
                    const jobDate = new Date(job.completedAt);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return jobDate > weekAgo && (job.technicianId === user.id || job.technicianName === user.name);
                  }).length}
                </p>
              </div>
            </div>
          )}

          {/* Filters - Compact */}
          <div className="mb-4 flex flex-wrap gap-3 items-end">
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-lg py-1.5 px-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-600 mb-1">Service Type</label>
              <select
                value={filterServiceType}
                onChange={(e) => setFilterServiceType(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-lg py-1.5 px-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Services</option>
                <option value="Detail">Detail</option>
                <option value="Delivery">Delivery</option>
                <option value="Rewash">Rewash</option>
                <option value="Lot Car">Lot Car</option>
                <option value="FCTP">FCTP</option>
                <option value="Cleanup">Cleanup</option>
                <option value="Showroom">Showroom</option>
              </select>
            </div>
            {(filterDate || filterServiceType) && (
              <button
                onClick={() => {
                  setFilterDate('');
                  setFilterServiceType('');
                }}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {completedJobs
              .filter(job => {
                // Filter by technician
                const isMyJob = job.technicianId === user.id ||
                               job.technicianName === user.name ||
                               (job.assignedTechnicianIds && job.assignedTechnicianIds.includes(user.id));
                if (!isMyJob) return false;

                // Filter by date
                if (filterDate) {
                  const jobDate = job.completedAt ? new Date(job.completedAt).toISOString().split('T')[0] :
                                 job.date ? job.date : null;
                  if (jobDate !== filterDate) return false;
                }

                // Filter by service type
                if (filterServiceType && job.serviceType !== filterServiceType) return false;

                return true;
              })
              .slice(0, 10)
              .map(job => (
                <button
                  key={job.id}
                  onClick={() => openJobDetails(job)}
                  className="w-full text-left bg-black hover:bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.01]"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-white font-bold text-xl">{job.vehicleDescription}</h4>
                        {job.color && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-semibold">
                            {job.color}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div className="bg-black rounded-xl p-3">
                          <p className="text-gray-500 font-medium mb-1">Stock Number</p>
                          <p className="text-white font-bold">{job.stockNumber}</p>
                        </div>
                        <div className="bg-black rounded-xl p-3">
                          <p className="text-gray-500 font-medium mb-1">VIN</p>
                          <p className="font-mono text-white font-bold text-sm">{job.vin?.slice(-6) || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm mb-3">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">{job.serviceType}</span>
                        {job.priority && job.priority !== 'Normal' && (
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            job.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                            job.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-900 text-gray-700'
                          }`}>
                            {job.priority}
                          </span>
                        )}
                      </div>
                      {job.salesPerson && (
                        <p className="text-purple-700 font-semibold text-sm mb-2">Sales: {job.salesPerson}</p>
                      )}
                      <div className="text-sm text-gray-600">
                        {job.startTime && (
                          <p>Started: {DateUtils.formatDateTime(job.startTime)}</p>
                        )}
                        {job.completedAt && (
                          <p>Completed: {DateUtils.formatDateTime(job.completedAt)}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-6 flex flex-col items-end">
                      <span className={`px-4 py-2 rounded-2xl text-sm font-bold mb-3 ${
                        job.status === 'In Progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {job.status}
                      </span>
                      {job.completedAt && (job.startTime || job.startedAt) && (
                        <div className="bg-green-50 rounded-2xl p-4 text-center">
                          <p className="text-green-700 font-bold text-2xl">
                            {DateUtils.formatDuration(
                              DateUtils.calculateDuration(
                                job.startTime || job.startedAt,
                                job.completedAt
                              )
                            )}
                          </p>
                          <p className="text-green-600 text-sm font-semibold">Total Time</p>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            {completedJobs.filter(job =>
              job.assignedTechnicianIds?.includes(user.id) ||
              job.technicianId === user.id ||
              job.technicianId === user.pin
            ).length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-white font-semibold">No jobs completed yet</p>
                <p className="text-gray-600 text-sm mt-1">Your completed jobs will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Job Details Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black rounded-xl p-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-800">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-white font-semibold text-base">Job Details</h4>
                <button
                  onClick={closeJobDetails}
                  className="w-8 h-8 bg-gray-900 hover:bg-gray-800 rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loading && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <p className="text-gray-600 font-semibold">Loading job details…</p>
                </div>
              )}
              {error && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-red-600 font-semibold">{error}</p>
                </div>
              )}

            {jobDetails && (
              <div className="space-y-3">
                {/* Compact Vehicle & Job Information */}
                <div className="bg-black rounded-xl p-3 border border-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <h5 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Vehicle
                      </h5>
                      <p className="text-white font-semibold text-base mb-2">{selectedJob.vehicleDescription}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div className="flex items-center gap-1"><span className="text-gray-500">VIN:</span><span className="font-mono text-white">{jobDetails.job?.vin}</span></div>
                        <div className="flex items-center gap-1"><span className="text-gray-500">Stock:</span><span className="text-white">{jobDetails.job?.stockNumber}</span></div>
                        {jobDetails.job?.color && <div className="flex items-center gap-1"><span className="text-gray-500">Color:</span><span className="text-white">{jobDetails.job.color}</span></div>}
                        <div className="flex items-center gap-1"><span className="text-gray-500">Service:</span><span className="text-blue-400">{jobDetails.job?.serviceType}</span></div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600">Priority:</span>
                          <select
                            value={jobDetails.job?.priority || 'Normal'}
                            onChange={(e) => handlePriorityChange(e.target.value)}
                            className="bg-black text-white border border-gray-700 rounded px-1.5 py-0.5 text-xs font-medium"
                          >
                            <option value="Low">Low</option>
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600">Salesperson:</span>
                          <input
                            type="text"
                            value={jobDetails.job?.salesPerson || ''}
                            onChange={(e) => handleSalesPersonChange(e.target.value)}
                            placeholder="Name"
                            className="bg-black text-white border border-gray-700 rounded px-1.5 py-0.5 text-xs flex-1"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="bg-black rounded-lg p-3 border border-blue-200">
                      <h5 className="text-white font-semibold mb-2 text-sm flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Timing
                      </h5>
                      <div className={`text-sm font-bold mb-2 ${
                        jobDetails.job?.status === 'In Progress' ? 'text-yellow-700' : 'text-green-700'
                      }`}>
                        {jobDetails.job?.status}
                      </div>
                      {jobDetails.job?.startTime && (
                        <div className="space-y-1 text-xs">
                          <p className="text-gray-600">Started: <span className="text-white font-medium">{new Date(jobDetails.job.startTime).toLocaleTimeString()}</span></p>
                          {jobDetails.job?.status === 'In Progress' && (
                            <div>
                              <p className="text-gray-600 mb-1">Duration:</p>
                              <LiveTimer startTime={jobDetails.job.startTime} className="text-yellow-700 font-mono text-xl font-bold" />
                            </div>
                          )}
                          {jobDetails.job?.completedAt && (
                            <div>
                              <p className="text-gray-600">Completed: <span className="text-white font-medium">{new Date(jobDetails.job.completedAt).toLocaleTimeString()}</span></p>
                              <p className="text-green-700 text-base font-bold mt-1">
                                {DateUtils.formatDuration(
                                  DateUtils.calculateDuration(jobDetails.job.startTime, jobDetails.job.completedAt)
                                )}
                              </p>
                            </div>
                          )}
                          {jobDetails.job?.technicianName && (
                            <p className="text-gray-600 pt-1 border-t border-gray-800">Tech: <span className="text-white font-medium">{jobDetails.job.technicianName}</span></p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Activity Timeline */}
                <div className="bg-black rounded-lg p-3 border border-gray-800">
                  <h5 className="text-white font-semibold mb-2 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Activity Timeline
                  </h5>
                  <ul className="space-y-2 max-h-36 overflow-auto pr-1">
                    {jobDetails.job?.startTime && (
                      <li className="text-xs border-l-2 border-green-500 pl-2 py-1">
                        <span className="text-green-700 font-semibold">Started</span>
                        <span className="text-gray-500 block text-[11px]">
                          {DateUtils.formatDateTime(jobDetails.job.startTime)}
                          {jobDetails.job?.technicianName && ` • ${jobDetails.job.technicianName}`}
                        </span>
                      </li>
                    )}
                    {jobDetails.job?.completedAt && (
                      <li className="text-xs border-l-2 border-blue-500 pl-2 py-1">
                        <span className="text-blue-700 font-semibold">Completed</span>
                        <span className="text-gray-500 block text-[11px]">
                          {DateUtils.formatDateTime(jobDetails.job.completedAt)}
                          {jobDetails.job?.duration && ` • ${DateUtils.formatDuration(jobDetails.job.duration)}`}
                        </span>
                      </li>
                    )}
                    {(jobDetails.events || []).map((ev, idx) => {
                      const validDate = DateUtils.getValidDate(ev.timestamp || ev.at);
                      return (
                        <li key={idx} className="text-xs border-l-2 border-gray-400 pl-2 py-1">
                          <span className="text-white font-semibold">
                            {ev.type?.replace('_', ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Event'}
                          </span>
                          <span className="text-gray-500 block text-[11px]">
                            {validDate ? DateUtils.formatDateTime(validDate) : 'Invalid Date'}
                            {ev.userName && ` • ${ev.userName}`}
                          </span>
                        </li>
                      );
                    })}
                    {(!jobDetails.job?.startTime && (!jobDetails.events || jobDetails.events.length === 0)) && (
                      <li className="text-gray-500 text-xs italic">No activity recorded</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DetailerDashboard;
