import React, { useState } from 'react';
import { V2 } from '../../utils/v2Client';

function UsersView({ users, detailers, onDeleteUser }) {
  const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'detailer', phone: '' });
  const [isAdding, setIsAdding] = useState(false);

  const handleAddDetailer = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.pin) return;
    if (newUser.pin.length !== 4) {
      alert('PIN must be exactly 4 digits');
      return;
    }

    setIsAdding(true);
    try {
      await V2.post('/users', {
        name: newUser.name,
        pin: newUser.pin,
        role: newUser.role,
        phone: newUser.phone
      });
      setNewUser({ name: '', pin: '', role: 'detailer', phone: '' });
      alert('User added successfully');
      // FIXED: Reload users to show new team member
      window.location.reload();
    } catch (err) {
      alert('Failed to add user: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-8 text-[color:var(--x-text-primary)]">
      <div className="x-card x-fade-in">
        <div className="space-y-2 mb-6">
          <h3 className="x-title">Add New Team Member</h3>
          <p className="x-subtitle">Provision credentials for detailers, sales, or management.</p>
        </div>
        <form onSubmit={handleAddDetailer} className="x-stack">
          <input
            type="text"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            placeholder="Full Name"
            className="x-input"
            required
          />
          <input
            type="text"
            value={newUser.pin}
            onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\\D/g, '') })}
            placeholder="4-Digit PIN"
            maxLength="4"
            className="x-input"
            required
          />
          <input
            type="tel"
            value={newUser.phone}
            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            placeholder="Phone Number (optional)"
            className="x-input"
          />
          <div className="x-stack">
            <label className="x-subtitle" htmlFor="user-role">Role</label>
            <select
              id="user-role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="x-input"
            >
              <option value="detailer">Detailer</option>
              <option value="salesperson">Salesperson</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="x-button w-full"
          >
            {isAdding ? 'Adding…' : 'Add Member'}
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
                  <span className="x-badge">{member.role}</span>
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
}

export default UsersView;
