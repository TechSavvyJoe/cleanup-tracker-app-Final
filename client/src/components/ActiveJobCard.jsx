import React, { useState } from 'react';
import LiveTimer from './LiveTimer';
import DateUtils from '../utils/dateUtils';

/**
 * Enterprise Active Job Card with X-style design
 * Premium UI for displaying current job details
 */
export default function ActiveJobCard({
  userActiveJob,
  details,
  elapsed,
  onCompleteJob,
  onJobAction,
  onOpenScanner,
  onGoToNewJob,
  onRefreshInventory
}) {
  const [showTimeline, setShowTimeline] = useState(false);

  const fmt = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  if (!userActiveJob) {
    return (
      <div className="bg-x-bg-secondary rounded-2xl p-8 border border-x-border shadow-x-card animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-x-blue to-x-purple rounded-xl flex items-center justify-center shadow-glow-blue">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-x-text">Start a New Job</h3>
          </div>
          <button
            onClick={onRefreshInventory}
            className="px-4 py-2 bg-x-bg-hover hover:bg-x-bg border border-x-border text-x-text-secondary hover:text-x-text font-medium rounded-full transition-all duration-200 text-sm flex items-center gap-2 group"
          >
            <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        <p className="text-x-text-secondary mb-6 text-sm">Scan a VIN barcode or search by VIN/Stock number to begin your next job.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={onOpenScanner}
            className="group relative overflow-hidden bg-gradient-to-r from-x-blue to-blue-600 hover:from-x-blue-hover hover:to-blue-700 text-white font-bold py-8 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-glow-blue transform hover:scale-[1.02] flex flex-col items-center justify-center gap-3"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <svg className="w-8 h-8 group-hover:scale-110 transition-transform duration-200 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="relative z-10">Scan VIN</span>
            <span className="text-xs text-blue-100 relative z-10">Use barcode scanner</span>
          </button>
          <button
            onClick={onGoToNewJob}
            className="group relative overflow-hidden bg-gradient-to-r from-x-green to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-8 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-glow-green transform hover:scale-[1.02] flex flex-col items-center justify-center gap-3"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <svg className="w-8 h-8 group-hover:scale-110 transition-transform duration-200 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="relative z-10">Search Vehicle</span>
            <span className="text-xs text-green-100 relative z-10">Search by VIN or Stock</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-x-bg-secondary rounded-2xl p-8 border border-x-border shadow-x-hover animate-fade-in relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-x-blue/5 via-transparent to-x-green/5 animate-pulse" style={{animationDuration: '3s'}}></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-x-green to-emerald-600 rounded-xl flex items-center justify-center shadow-glow-green animate-bounce-subtle">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-x-text">Active Job</h3>
              <p className="text-x-text-secondary text-sm">In Progress</p>
            </div>
          </div>

          {/* Live Timer */}
          {details && userActiveJob.startTime && (
            <LiveTimer
              startTime={userActiveJob.startTime}
              className="text-2xl font-mono"
              showIcon={true}
              compact={false}
              glowColor="green"
            />
          )}
        </div>

        {/* Vehicle Info Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-4">
            {/* Vehicle Description */}
            <div className="bg-x-bg-hover rounded-xl p-6 border border-x-border hover:border-x-blue/50 transition-colors duration-200">
              <h4 className="text-3xl font-bold text-x-text mb-4">{userActiveJob.vehicleDescription}</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-x-bg rounded-lg p-4 border border-blue-500/30">
                  <p className="text-x-blue font-medium text-xs mb-1">Service Type</p>
                  <p className="text-x-text font-bold text-sm">{userActiveJob.serviceType}</p>
                </div>
                <div className="bg-x-bg rounded-lg p-4 border border-purple-500/30">
                  <p className="text-x-purple font-medium text-xs mb-1">Stock Number</p>
                  <p className="text-x-text font-bold text-sm">{userActiveJob.stockNumber}</p>
                </div>
                {userActiveJob.vin && (
                  <div className="bg-x-bg rounded-lg p-4 border border-x-border col-span-2">
                    <p className="text-x-text-secondary font-medium text-xs mb-1">VIN</p>
                    <p className="text-x-text font-mono text-xs">{userActiveJob.vin}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Start Time */}
            {details && (
              <div className="bg-x-bg-hover rounded-xl p-4 border border-x-border">
                <p className="text-x-text-secondary font-medium text-sm">
                  Started at {DateUtils.formatDate(
                    (details.job?.startedAt) || (details.events?.[0]?.timestamp) || Date.now(),
                    { hour: '2-digit', minute: '2-digit', second: '2-digit' }
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Stats Column */}
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-br from-x-green/10 to-emerald-600/10 rounded-xl p-6 border border-x-green/30 text-center">
              <p className="text-x-green font-semibold text-sm mb-2">Elapsed Time</p>
              <p className="text-4xl font-bold text-x-text font-mono mb-3">{fmt(elapsed)}</p>
              <div className="w-full bg-x-green/20 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-x-green to-emerald-500 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Secondary Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => onJobAction('pause')}
              className="flex-1 bg-x-bg-hover hover:bg-x-yellow/10 border border-x-border hover:border-x-yellow text-x-text hover:text-x-yellow font-bold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] text-sm group"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pause
              </div>
            </button>
            <button
              onClick={() => onJobAction('addTechnician')}
              className="flex-1 bg-x-bg-hover hover:bg-x-blue/10 border border-x-border hover:border-x-blue text-x-text hover:text-x-blue font-bold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] text-sm group"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add Helper
              </div>
            </button>
            <button
              onClick={() => onJobAction('message')}
              className="flex-1 bg-x-bg-hover hover:bg-x-green/10 border border-x-border hover:border-x-green text-x-text hover:text-x-green font-bold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] text-sm group"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message
              </div>
            </button>
          </div>

          {/* Primary Completion Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => onCompleteJob('completed')}
              className="flex-1 relative overflow-hidden bg-gradient-to-r from-x-green to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-glow-green transform hover:scale-[1.02] group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              <div className="relative z-10 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Complete - Ready for Delivery
              </div>
            </button>
            <button
              onClick={() => onCompleteJob('qc_required')}
              className="flex-1 relative overflow-hidden bg-gradient-to-r from-x-yellow to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-yellow-500/50 transform hover:scale-[1.02] group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              <div className="relative z-10 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Complete - Needs QC Review
              </div>
            </button>
          </div>

          {/* Timeline Toggle */}
          {details && (
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="w-full px-6 py-3 bg-x-bg-hover hover:bg-x-bg border border-x-border hover:border-x-blue/50 text-x-text font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <svg className={`w-4 h-4 transition-transform duration-300 ${showTimeline ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
              {showTimeline ? 'Hide' : 'Show'} Job Timeline
            </button>
          )}
        </div>

        {/* Timeline */}
        {showTimeline && details && (
          <div className="mt-6 bg-x-bg-hover rounded-xl p-6 border border-x-border animate-slide-down">
            <h5 className="font-bold text-x-text mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-x-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Job Timeline
            </h5>
            <ul className="space-y-3 max-h-96 overflow-auto">
              {(details.events || []).map((ev, idx) => (
                <li key={idx} className="flex items-start gap-4 p-4 bg-x-bg rounded-lg border border-x-border hover:border-x-blue/30 transition-colors duration-200 animate-fade-in">
                  <div className="w-3 h-3 bg-x-blue rounded-full mt-1 animate-pulse"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-x-text">{ev.type}</span>
                      {ev.userName && (
                        <span className="text-xs px-2 py-0.5 bg-x-blue/20 text-x-blue rounded-full">{ev.userName}</span>
                      )}
                    </div>
                    <p className="text-x-text-secondary text-sm mt-1">{DateUtils.formatDate(ev.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
