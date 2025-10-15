import React, { useState, useEffect } from 'react';
import { V2 } from '../../utils/v2Client';

function SalespersonDashboard({ user, jobs }) {
  const [myJobs, setMyJobs] = useState([]);

  // Filter jobs assigned to this salesperson
  useEffect(() => {
    if (jobs) {
      const filtered = jobs.filter(job =>
        job.salesPerson === user.name ||
        job.salesPerson === user.employeeId ||
        job.salesPerson === user.id
      );
      setMyJobs(filtered);
    }
  }, [jobs, user]);

  const handleQualityCheck = async (jobId, passed) => {
    try {
      await V2.post(`/jobs/${jobId}/qc`, {
        qcCheckerId: user.employeeId || user.id,
        qcCheckerName: user.name,
        qcPassed: passed,
        qcNotes: passed ? 'Quality check passed' : 'Quality check failed - needs attention'
      });
      alert('Quality check recorded successfully');
    } catch (err) {
      alert('QC update failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleMessage = async (jobId, recipientType) => {
    const message = prompt('Enter your message:');
    if (!message) return;

    try {
      await V2.post(`/jobs/${jobId}/message`, {
        message,
        fromUserId: user.id,
        fromUserName: user.name,
        recipientType // 'detailer' or 'sales'
      });
      alert('Message sent successfully');
    } catch (err) {
      alert('Message failed: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-black rounded-3xl p-8 shadow-xl mb-8 border border-gray-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Sales Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-blue-700 font-semibold text-sm">My Jobs</p>
                  <p className="text-2xl font-bold text-blue-900">{myJobs.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-700 font-semibold text-sm">Completed</p>
                  <p className="text-2xl font-bold text-green-900">
                    {myJobs.filter(j => j.status === 'Completed').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-orange-700 font-semibold text-sm">In Progress</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {myJobs.filter(j => j.status === 'In Progress').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="bg-black rounded-3xl p-8 shadow-xl border border-gray-800">
          <h3 className="text-2xl font-bold text-white mb-6">My Vehicle Jobs</h3>

          <div className="space-y-4">
            {myJobs.map(job => (
              <div key={job.id} className="job-card bg-black rounded-2xl p-4 md:p-3 border border-gray-800 hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-gray-700">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <h4 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">
                      {job.year} {job.make} {job.model} {job.vehicleColor && `• ${job.vehicleColor}`}
                    </h4>
                    <div className="job-info-grid grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-xs md:text-sm mb-3">
                      <div>
                        <p className="text-gray-600 font-medium text-xs">VIN</p>
                        <p className="text-white font-semibold font-mono text-xs">{job.vin?.slice(-6)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium text-xs">Stock</p>
                        <p className="text-white font-semibold">{job.stockNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium text-xs">Service</p>
                        <p className="text-blue-700 font-semibold">{job.serviceType}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium text-xs">Technician</p>
                        <p className="text-white font-semibold">{job.technicianName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`status-badge px-2 md:px-3 py-1 rounded-full text-xs font-bold border ${
                        job.status === 'Completed' ? 'status-completed' :
                        job.status === 'In Progress' ? 'status-in-progress' :
                        job.status === 'QC Required' ? 'status-qc-required' :
                        job.status === 'Failed QC' ? 'status-failed-qc' :
                        'status-pending'
                      }`}>
                        {job.status}
                      </span>

                      {job.priority && job.priority !== 'Normal' && (
                        <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold border ${
                          job.priority === 'Urgent' ? 'priority-urgent' :
                          job.priority === 'High' ? 'priority-high' :
                          job.priority === 'Low' ? 'priority-low' :
                          'priority-normal'
                        }`}>
                          {job.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 ml-2">
                    {job.status === 'Completed' && !job.qcCompleted && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQualityCheck(job.id, true); }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                        >
                          Pass
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQualityCheck(job.id, false); }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                        >
                          Fail
                        </button>
                      </div>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); handleMessage(job.id, 'detailer'); }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      Message
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {myJobs.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-gray-500 font-semibold">No jobs assigned yet</p>
                <p className="text-gray-400 text-sm mt-1">Jobs assigned to you will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalespersonDashboard;
