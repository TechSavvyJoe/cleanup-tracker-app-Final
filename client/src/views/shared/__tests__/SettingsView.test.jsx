import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsView from '../SettingsView';
import { V2 } from '../../../utils/v2Client';
import { ToastProvider } from '../../../components/Toast';

jest.mock('../../../utils/v2Client', () => ({
  V2: {
    put: jest.fn(),
    post: jest.fn(),
    get: jest.fn().mockResolvedValue({ data: {} })
  }
}));

describe('SettingsView', () => {
  const renderView = (props = {}) => render(
    <ToastProvider>
      <SettingsView {...props} />
    </ToastProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    V2.get.mockResolvedValue({ data: {} });
    V2.put.mockResolvedValue({});
    V2.post.mockResolvedValue({});
  });

  it('saves site title changes and refreshes settings', async () => {
    const onSettingsChange = jest.fn();

    renderView({
      settings: { siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' },
      onSettingsChange
    });

    fireEvent.change(screen.getByLabelText(/Workspace title/i), {
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

    // Check that settings updated toast is shown
    await waitFor(() => {
      expect(screen.getByText(/Settings updated/i)).toBeTruthy();
    });
  });

  it('saves CSV URL through vehicles/set-csv when provided', async () => {
    const onSettingsChange = jest.fn();
    const incomingSettings = { siteTitle: 'new title', inventoryCsvUrl: 'https://example.com/csv' };
    V2.get.mockResolvedValue({ data: incomingSettings });

    renderView({
      settings: { siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' },
      onSettingsChange
    });

    fireEvent.change(screen.getByLabelText(/Workspace title/i), {
      target: { value: 'Cleanup Tracker' }
    });
    fireEvent.change(screen.getByLabelText(/Published CSV URL/i), {
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
    
    // Check that settings updated toast is shown
    await waitFor(() => {
      expect(screen.getByText(/Settings updated/i)).toBeTruthy();
    });
  });

  it('falls back to saving inventoryCsvUrl when set-csv fails', async () => {
    const onSettingsChange = jest.fn();
    V2.post.mockRejectedValueOnce(new Error('Bad CSV'));

    renderView({
      settings: { siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' },
      onSettingsChange
    });

    fireEvent.change(screen.getByLabelText(/Workspace title/i), {
      target: { value: 'Cleanup Tracker' }
    });
    fireEvent.change(screen.getByLabelText(/Published CSV URL/i), {
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
    
    // Check that settings updated toast is shown
    await waitFor(() => {
      expect(screen.getByText(/Settings updated/i)).toBeTruthy();
    });
  });

  it('refreshes inventory after saving when using Save & Import', async () => {
    renderView({
      settings: { siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' },
      onSettingsChange: jest.fn()
    });

  fireEvent.click(screen.getByRole('button', { name: /sync & refresh inventory/i }));

    await waitFor(() => {
      expect(V2.post).toHaveBeenCalledWith('/vehicles/refresh');
    });
    
    // Check that success toast is shown
    await waitFor(() => {
      expect(screen.getByText(/Settings saved and inventory refreshed/i)).toBeTruthy();
    });
  });

  it('refreshes inventory without saving when clicking Refresh Inventory', async () => {
    renderView({
      settings: { siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' },
      onSettingsChange: jest.fn()
    });

    // The UI renders two similar buttons (compact and full-width). Prefer the
    // exact text for the compact button.
    const refreshButton = screen.getAllByRole('button', { name: /refresh only/i })[0];
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(V2.post).toHaveBeenCalledWith('/vehicles/refresh');
    });
    expect(V2.put).not.toHaveBeenCalled();
    
    // Check that info toast is shown
    await waitFor(() => {
      expect(screen.getByText(/Inventory refresh triggered/i)).toBeTruthy();
    });
  });

  it('updates inputs when settings prop changes', () => {
    const { rerender } = render(
      <ToastProvider>
        <SettingsView
          settings={{ siteTitle: 'Cleanup Tracker', inventoryCsvUrl: '' }}
          onSettingsChange={jest.fn()}
        />
      </ToastProvider>
    );

    rerender(
      <ToastProvider>
        <SettingsView
          settings={{ siteTitle: 'Updated Title', inventoryCsvUrl: 'https://example.com/csv' }}
          onSettingsChange={jest.fn()}
        />
      </ToastProvider>
    );

  expect(screen.getByLabelText(/Workspace title/i).value).toBe('Updated Title');
  expect(screen.getByLabelText(/Published CSV URL/i).value).toBe('https://example.com/csv');
  });
});
