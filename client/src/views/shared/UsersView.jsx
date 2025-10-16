import React, { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { V2 } from '../../utils/v2Client';
import { useToast } from '../../components/Toast';

const UsersView = memo(function UsersView({ users, detailers, onDeleteUser, onRefresh }) {
  const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'detailer', phone: '' });
  const [isAdding, setIsAdding] = useState(false);
  const toast = useToast();

  const handleAddDetailer = useCallback(async (e) => {
    e.preventDefault();

    // Validation
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
        phoneNumber: newUser.phone
      });

      setNewUser({ name: '', pin: '', role: 'detailer', phone: '' });
      toast.success(`${newUser.name} added successfully as ${newUser.role}`);

      // Refresh the user list
      if (onRefresh) await onRefresh();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;

      // Provide specific error guidance
      if (errorMsg.includes('duplicate') || errorMsg.includes('exists')) {
        toast.error('User already exists. Try a different name or PIN.');
      } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
        toast.error('Network error. Check your connection and try again.');
      } else if (errorMsg.includes('unauthorized')) {
        toast.error('You don\'t have permission to add users.');
      } else {
        toast.error(`Failed to add user: ${errorMsg}`);
      }
    } finally {
      setIsAdding(false);
    }
  }, [newUser, onRefresh, toast]);

  return (
    <div className="space-y-8 text-[color:var(--x-text-primary)]">
      <div className="x-card x-card--premium x-fade-in">
        <div className="space-y-2 mb-6">
          <h3 className="x-title">Add New Team Member</h3>
          <p className="x-subtitle">Provision credentials for detailers, sales, or management.</p>
        </div>
        <form onSubmit={handleAddDetailer} className="x-stack" aria-label="Add new user form">
          <div>
            <label htmlFor="user-name" className="sr-only">Full Name</label>
            <input
              id="user-name"
              type="text"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="Full Name"
              className="x-input"
              required
              disabled={isAdding}
              aria-required="true"
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="user-pin" className="sr-only">4-Digit PIN</label>
            <input
              id="user-pin"
              type="text"
              inputMode="numeric"
              value={newUser.pin}
              onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '') })}
              placeholder="4-Digit PIN"
              maxLength="4"
              className="x-input"
              required
              disabled={isAdding}
              aria-required="true"
              aria-describedby="pin-help"
            />
            <p id="pin-help" className="sr-only">Enter a 4-digit PIN for user authentication</p>
          </div>
          <div>
            <label htmlFor="user-phone" className="sr-only">Phone Number (optional)</label>
            <input
              id="user-phone"
              type="tel"
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              placeholder="Phone Number (optional)"
              className="x-input"
              disabled={isAdding}
              autoComplete="tel"
            />
          </div>
          <div className="x-stack">
            <label className="x-subtitle" htmlFor="user-role">Role</label>
            <select
              id="user-role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="x-select"
              disabled={isAdding}
              aria-required="true"
            >
              <option value="detailer">Detailer</option>
              <option value="salesperson">Salesperson</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isAdding || !newUser.name?.trim() || newUser.pin.length !== 4}
            className="x-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={isAdding}
          >
            {isAdding ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Adding…
              </span>
            ) : 'Add Member'}
          </button>
        </form>
      </div>

      <div className="x-card x-fade-in">
        <div className="space-y-2 mb-6">
          <h3 className="x-title">Team Members</h3>
          <p className="x-subtitle">Live roster synced with your Cleanup Tracker workspace.</p>
        </div>
        <div className="x-stack">
          {detailers.length === 0 && (
            <div className="x-banner">
              No members yet. Add your first teammate to kick things off.
            </div>
          )}
          {detailers.map((member) => (
            <div key={member.id || member._id} className="x-row">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{member.name}</p>
                  <span className={`x-badge ${
                    member.role === 'manager' ? 'x-badge--warning' :
                    member.role === 'salesperson' ? 'x-badge--success' :
                    'x-badge--neutral'
                  }`}>{member.role}</span>
                </div>
                <p className="text-sm x-text-subtle">PIN: {member.pin}</p>
                {member.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="x-text-subtle">Phone: {member.phone}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const message = `Hi ${member.name}, you have a new job assignment. Please check the system for details.`;
                        window.open(`sms:${member.phone}?body=${encodeURIComponent(message)}`, '_blank');
                      }}
                      className="font-medium text-[color:var(--x-blue)] hover:underline"
                    >
                      Send SMS
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDeleteUser(member.id || member._id)}
                className="x-button x-button--danger"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

UsersView.propTypes = {
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    _id: PropTypes.string,
    name: PropTypes.string,
    role: PropTypes.string,
    pin: PropTypes.string,
    phone: PropTypes.string
  })),
  detailers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    _id: PropTypes.string,
    name: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
    pin: PropTypes.string,
    phone: PropTypes.string
  })).isRequired,
  onDeleteUser: PropTypes.func.isRequired,
  onRefresh: PropTypes.func
};

UsersView.displayName = 'UsersView';

export default UsersView;
