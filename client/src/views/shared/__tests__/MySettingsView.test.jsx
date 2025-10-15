import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MySettingsView from '../MySettingsView';
import { V2 } from '../../../utils/v2Client';

jest.mock('../../../utils/v2Client', () => ({
  V2: {
    get: jest.fn(),
    put: jest.fn()
  }
}));

describe('MySettingsView', () => {
  const baseUser = {
    id: 'user-1',
    name: 'Manager',
    role: 'manager',
    pin: '1234'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
  });

  it('updates profile details for managers including optional PIN', async () => {
    V2.get.mockResolvedValue({
      data: [
        { id: 'user-1', name: 'Manager', role: 'manager', pin: '1234' }
      ]
    });
    V2.put.mockResolvedValue({});

    render(<MySettingsView user={baseUser} />);

    const nameInput = screen.getByLabelText(/Display Name/i);
    const pinInput = screen.getByLabelText(/New PIN/i);

    fireEvent.change(nameInput, { target: { value: 'Updated Manager' } });
    fireEvent.change(pinInput, { target: { value: '5678' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(V2.put).toHaveBeenCalledWith('/users/user-1', expect.objectContaining({
        name: 'Updated Manager',
        pin: '5678'
      }));
    });

    expect(window.alert).toHaveBeenCalledWith('Profile updated');
  });

  it('updates manager name without sending a PIN when left blank', async () => {
    V2.get.mockResolvedValue({
      data: [
        { id: 'user-1', name: 'Manager', role: 'manager', pin: '1234' }
      ]
    });
    V2.put.mockResolvedValue({});

    render(<MySettingsView user={baseUser} />);

    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: 'Renamed Manager' }
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(V2.put).toHaveBeenCalledWith('/users/user-1', {
        name: 'Renamed Manager',
        role: 'manager'
      });
    });

    expect(window.alert).toHaveBeenCalledWith('Profile updated');
  });

  it('requires a non-empty name', () => {
    render(<MySettingsView user={baseUser} />);

    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: ' ' }
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(window.alert).toHaveBeenCalledWith('Name is required');
    expect(V2.get).not.toHaveBeenCalled();
    expect(V2.put).not.toHaveBeenCalled();
  });

  it('validates PIN length for managers', () => {
    render(<MySettingsView user={baseUser} />);

    fireEvent.change(screen.getByLabelText(/New PIN/i), {
      target: { value: '12' }
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(window.alert).toHaveBeenCalledWith('PIN must be 4 digits');
    expect(V2.get).not.toHaveBeenCalled();
    expect(V2.put).not.toHaveBeenCalled();
  });

  it('alerts when the current user cannot be found', async () => {
    V2.get.mockResolvedValue({ data: [] });

    render(<MySettingsView user={baseUser} />);

    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: 'Unknown Manager' }
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Cannot locate your profile');
    });
    expect(V2.put).not.toHaveBeenCalled();
  });

  it('surfaces API failures to the user', async () => {
    V2.get.mockResolvedValue({
      data: [
        { id: 'user-1', name: 'Manager', role: 'manager', pin: '1234' }
      ]
    });
    V2.put.mockRejectedValue(new Error('Server down'));

    render(<MySettingsView user={baseUser} />);

    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: 'Manager' }
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to update: Server down');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i }).disabled).toBe(false);
    });
  });
});
