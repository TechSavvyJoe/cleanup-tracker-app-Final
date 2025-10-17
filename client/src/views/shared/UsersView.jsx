import React, { useState, useCallback, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import { V2 } from '../../utils/v2Client';
import { useToast } from '../../components/Toast';

const roleTheme = {
  manager: { badge: 'bg-amber-500/15 text-amber-200 border border-amber-400/40', title: 'Manager' },
  salesperson: { badge: 'bg-blue-500/15 text-blue-200 border border-blue-400/40', title: 'Sales' },
  detailer: { badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40', title: 'Detailer' }
};

const UsersView = memo(function UsersView({ users, detailers, onDeleteUser, onRefresh }) {
  const toast = useToast();
  const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'detailer', phone: '' });
  const [isAdding, setIsAdding] = useState(false);

  const roster = useMemo(() => {
    const normalized = Object.values(users || {});
    if (normalized.length > 0) {
      return normalized;
    }
    return Array.isArray(detailers) ? detailers : [];
  }, [users, detailers]);

  const detailerCount = useMemo(
    () => roster.filter(member => member.role === 'detailer').length,
    [roster]
  );
  const managerCount = useMemo(
    () => roster.filter(member => member.role === 'manager').length,
    [roster]
  );
  const salesCount = useMemo(
    () => roster.filter(member => member.role === 'salesperson').length,
    [roster]
  );
  const sortedRoster = useMemo(
    () => roster.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [roster]
  );

  const handleAddDetailer = useCallback(async (e) => {
    e.preventDefault();

    if (!newUser.name?.trim()) {
      toast.error('Please enter a name');
      return;
    }

    if (!newUser.pin) {
      toast.error('Please enter a PIN');
      return;
    }

    if (newUser.pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    setIsAdding(true);
    try {
      await V2.post('/users', {
        name: newUser.name.trim(),
        pin: newUser.pin,
        role: newUser.role,
        phoneNumber: newUser.phone,
        employeeNumber: newUser.pin
      });

      setNewUser({ name: '', pin: '', role: 'detailer', phone: '' });
      toast.success(`${newUser.name} added successfully as ${newUser.role}`);

      if (onRefresh) await onRefresh();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;

      if (errorMsg.includes('duplicate') || errorMsg.includes('exists')) {
        toast.error('User already exists. Try a different name or PIN.');
      } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
        toast.error('Network error. Check your connection and try again.');
      } else if (errorMsg.includes('unauthorized')) {
        toast.error('You do not have permission to add users.');
      } else {
        toast.error(`Failed to add user: ${errorMsg}`);
      }
    } finally {
      setIsAdding(false);
    }
  }, [newUser, onRefresh, toast]);

  return (
    <div className="space-y-8 text-[color:var(--x-text-primary)]">
      <header className="bg-gradient-to-r from-blue-500/10 via-blue-600/5 to-transparent border border-blue-600/20 rounded-3xl px-6 py-5 shadow-lg shadow-blue-500/5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-200">Team Management</p>
            <h2 className="mt-2 text-2xl lg:text-3xl font-semibold text-white">Keep your Cleanup Tracker credentials in sync</h2>
            <p className="mt-2 text-sm text-blue-100/80 max-w-2xl">
              Provision new detailers in seconds, assign sales and manager roles, and keep contact information current for job notifications.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="rounded-2xl border border-gray-800 bg-black/70 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Active detailers</p>
              <p className="mt-1 text-lg font-semibold text-white">{detailerCount}</p>
              <p className="mt-1 text-xs text-gray-500">Ready to clock in today</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-black/70 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Sales</p>
              <p className="mt-1 text-lg font-semibold text-white">{salesCount}</p>
              <p className="mt-1 text-xs text-gray-500">Receives job notifications</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-black/70 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Managers</p>
              <p className="mt-1 text-lg font-semibold text-white">{managerCount}</p>
              <p className="mt-1 text-xs text-gray-500">Can edit service catalog</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,1.1fr)_minmax(360px,1fr)]">
        <section className="rounded-3xl border border-gray-800 bg-black/70 px-6 py-6 shadow-xl shadow-black/20">
          <h3 className="text-white text-lg font-semibold">Invite a teammate</h3>
          <p className="mt-2 text-sm text-gray-500">Provide name, PIN, and role. PINs must be four digits and unique.</p>

          <form onSubmit={handleAddDetailer} className="mt-6 space-y-5" aria-label="Add new user form">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor="user-name">Full name</label>
                <input
                  id="user-name"
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Jordan Ellis"
                  className="mt-2 w-full rounded-xl border border-gray-700 bg-black py-2.5 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={isAdding}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor="user-pin">4-digit PIN</label>
                <input
                  id="user-pin"
                  type="text"
                  inputMode="numeric"
                  value={newUser.pin}
                  onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '') })}
                  placeholder="1234"
                  maxLength="4"
                  className="mt-2 w-full rounded-xl border border-gray-700 bg-black py-2.5 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={isAdding}
                  aria-describedby="pin-help"
                />
                <p id="pin-help" className="mt-1 text-xs text-gray-500">Used for clock-in/out and kiosk login.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor="user-phone">Phone (optional)</label>
                <input
                  id="user-phone"
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="555-0100"
                  className="mt-2 w-full rounded-xl border border-gray-700 bg-black py-2.5 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAdding}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-gray-500" htmlFor="user-role">Role</label>
                <select
                  id="user-role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-gray-700 bg-black py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAdding}
                >
                  <option value="detailer">Detailer</option>
                  <option value="salesperson">Salesperson</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAdding || !newUser.name?.trim() || newUser.pin.length !== 4}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition ${isAdding || !newUser.name?.trim() || newUser.pin.length !== 4 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-black hover:from-emerald-500 hover:to-emerald-700 shadow-lg shadow-emerald-500/20'}`}
              aria-busy={isAdding}
            >
              {isAdding ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add team member
                </>
              )}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-black/70 px-6 py-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-white text-lg font-semibold">Current roster</h3>
              <p className="text-sm text-gray-500">Live view of everyone with Cleanup Tracker access.</p>
            </div>
            <button
              type="button"
              className="rounded-full border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white hover:border-gray-500"
              onClick={onRefresh}
            >
              Refresh roster
            </button>
          </div>

          <div className="mt-5 space-y-4 max-h-[520px] overflow-y-auto pr-1">
            {sortedRoster.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-700 bg-black/50 px-6 py-8 text-center text-sm text-gray-500">
                No team members yet. Add your first teammate to kick things off.
              </div>
            ) : (
              sortedRoster.map((member) => {
                const theme = roleTheme[member.role] || roleTheme.detailer;
                return (
                  <div key={member.id || member._id} className="rounded-2xl border border-gray-800 bg-black/60 px-5 py-5 shadow-inner">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-white text-base font-semibold">{member.name}</p>
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}>
                            {theme.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          <span>PIN <span className="font-mono text-white">{member.pin}</span></span>
                          {member.employeeNumber ? (
                            <span>Employee #{member.employeeNumber}</span>
                          ) : null}
                          {member.phone ? (
                            <span className="inline-flex items-center gap-2">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-1.704.852a11.042 11.042 0 006.102 6.102l.852-1.704a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                              {member.phone}
                            </span>
                          ) : null}
                        </div>
                        {member.phone && (
                          <button
                            type="button"
                            onClick={() => {
                              const message = `Hi ${member.name}, you have a new job assignment. Please check the system for details.`;
                              window.open(`sms:${member.phone}?body=${encodeURIComponent(message)}`, '_blank');
                            }}
                            className="text-xs font-semibold text-blue-300 hover:text-blue-100"
                          >
                            Send SMS alert
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => onDeleteUser(member.id || member._id)}
                          className="rounded-full border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-300 hover:text-red-100"
                        >
                          Remove access
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
});

UsersView.propTypes = {
  users: PropTypes.object,
  detailers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    role: PropTypes.string,
    pin: PropTypes.string,
    phone: PropTypes.string,
    employeeNumber: PropTypes.string
  })),
  onDeleteUser: PropTypes.func.isRequired,
  onRefresh: PropTypes.func
};

UsersView.defaultProps = {
  users: {},
  detailers: [],
  onRefresh: null
};

export default UsersView;
