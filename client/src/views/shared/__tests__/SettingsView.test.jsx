import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsView from '../SettingsView';
import { V2 } from '../../../utils/v2Client';

jest.mock('../../../utils/v2Client', () => ({
  V2: {
    put: jest.fn(),
    post: jest.fn(),
    get: jest.fn().mockResolvedValue({ data: {} })
  }
}));

describe('SettingsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    V2.get.mockResolvedValue({ data: {} });
    V2.put.mockResolvedValue({});
    V2.post.mockResolvedValue({});
  });

  it('saves site title changes and refreshes settings', async () => {
    const onSettingsChange = jest.fn();

    render(
      <SettingsView
        settings={{ siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' }}
        onSettingsChange={onSettingsChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/Site Title/i), {
      target: { value: 'New Title' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(V2.put).toHaveBeenCalledWith('/settings', {
        key: 'siteTitle',
        value: 'New Title'
      });
    });

    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({});
    });

    expect(window.alert).toHaveBeenCalledWith('Settings saved.');
  });

  it('saves CSV URL through vehicles/set-csv when provided', async () => {
    const onSettingsChange = jest.fn();
    const incomingSettings = { siteTitle: 'new title', inventoryCsvUrl: 'https://example.com/csv' };
    V2.get.mockResolvedValue({ data: incomingSettings });

    render(
      <SettingsView
        settings={{ siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' }}
        onSettingsChange={onSettingsChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/Site Title/i), {
      target: { value: 'Cleanup Tracker' }
    });
    fireEvent.change(screen.getByLabelText(/Google Sheets CSV URL/i), {
      target: { value: ' https://example.com/csv ' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(V2.put).toHaveBeenCalledWith('/settings', {
        key: 'siteTitle',
        value: 'Cleanup Tracker'
      });
    });

    await waitFor(() => {
      expect(V2.post).toHaveBeenCalledWith('/vehicles/set-csv', {
        url: 'https://example.com/csv'
      });
    });

    expect(onSettingsChange).toHaveBeenCalledWith(incomingSettings);
    expect(window.alert).toHaveBeenCalledWith('Settings saved.');
  });

  it('falls back to saving inventoryCsvUrl when set-csv fails', async () => {
    const onSettingsChange = jest.fn();
    V2.post.mockRejectedValueOnce(new Error('Bad CSV'));

    render(
      <SettingsView
        settings={{ siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' }}
        onSettingsChange={onSettingsChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/Site Title/i), {
      target: { value: 'Cleanup Tracker' }
    });
    fireEvent.change(screen.getByLabelText(/Google Sheets CSV URL/i), {
      target: { value: 'https://example.com/csv' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(V2.post).toHaveBeenCalledWith('/vehicles/set-csv', {
        url: 'https://example.com/csv'
      });
    });

    await waitFor(() => {
      expect(V2.put).toHaveBeenNthCalledWith(2, '/settings', {
        key: 'inventoryCsvUrl',
        value: 'https://example.com/csv'
      });
    });
    expect(window.alert).toHaveBeenCalledWith('Settings saved.');
  });

  it('refreshes inventory after saving when using Save & Import', async () => {
    render(
      <SettingsView
        settings={{ siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' }}
        onSettingsChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save & import/i }));

    await waitFor(() => {
      expect(V2.post).toHaveBeenCalledWith('/vehicles/refresh');
    });
    expect(window.alert).toHaveBeenCalledWith('Inventory refreshed from CSV.');
  });

  it('refreshes inventory without saving when clicking Refresh Inventory', async () => {
    render(
      <SettingsView
        settings={{ siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' }}
        onSettingsChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /refresh inventory/i }));

    await waitFor(() => {
      expect(V2.post).toHaveBeenCalledWith('/vehicles/refresh');
    });
    expect(V2.put).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Inventory refreshed.');
  });

  it('updates inputs when settings prop changes', () => {
    const { rerender } = render(
      <SettingsView
        settings={{ siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' }}
        onSettingsChange={jest.fn()}
      />
    );

    rerender(
      <SettingsView
        settings={{ siteTitle: 'Updated Title', inventoryCsvUrl: 'https://example.com/csv' }}
        onSettingsChange={jest.fn()}
      />
    );

    expect(screen.getByLabelText(/Site Title/i).value).toBe('Updated Title');
    expect(screen.getByLabelText(/Google Sheets CSV URL/i).value).toBe('https://example.com/csv');
  });
});
