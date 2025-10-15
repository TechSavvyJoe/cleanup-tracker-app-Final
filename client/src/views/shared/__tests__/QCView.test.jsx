import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import QCView from '../QCView';
import { V2 } from '../../../utils/v2Client';

jest.mock('../../../utils/v2Client', () => ({
  V2: {
    put: jest.fn()
  }
}));

describe('QCView', () => {
  const baseJobs = () => {
    const now = new Date();
    const todayIso = now.toISOString();
    return [
      {
        id: 'job-1',
        status: 'QC Required',
        year: 2023,
        make: 'Tesla',
        model: 'Model 3',
        vehicleColor: 'White',
        vin: 'VIN123',
        stockNumber: 'STK001',
        serviceType: 'Full Detail',
        technicianName: 'Jamie Detailer',
        completedAt: todayIso,
        updatedAt: todayIso
      },
      {
        id: 'job-2',
        status: 'Completed',
        completedAt: todayIso
      },
      {
        id: 'job-3',
        status: 'In Progress',
        qcNotes: 'Needs polish',
        updatedAt: todayIso
      }
    ];
  };

  const defaultUsers = { 'tech-1': { id: 'tech-1', name: 'Jamie Detailer', role: 'detailer' } };

  let originalPrompt;

  beforeAll(() => {
    originalPrompt = window.prompt;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    window.prompt = jest.fn();
  });

  afterAll(() => {
    window.prompt = originalPrompt;
  });

  const renderView = (override = {}) => {
    const jobs = override.jobs || baseJobs();
    return render(
      <QCView
        jobs={jobs}
        users={override.users || defaultUsers}
        currentUser={override.currentUser || { id: 'manager-1', role: 'manager' }}
        onRefresh={override.onRefresh || jest.fn()}
      />
    );
  };

  it('displays pending QC jobs and summary statistics', () => {
    renderView();

    const pendingCard = screen.getByText('Pending Review').closest('div');
    within(pendingCard).getByText('1');

    screen.getByText(/Tesla/i);
    screen.getByText('VIN123');
    screen.getByText('Full Detail');
  });

  it('shows empty state when no jobs require QC', () => {
    renderView({
      jobs: [
        { id: 'job-2', status: 'Completed', completedAt: new Date().toISOString() }
      ]
    });

    screen.getByText('All caught up!');
    screen.getByText('No jobs are currently waiting for quality control review.');
  });

  it('approves a job and triggers refresh', async () => {
    V2.put.mockResolvedValue({});
    const onRefresh = jest.fn();

    renderView({ onRefresh });

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(V2.put).toHaveBeenCalledWith('/jobs/job-1/status', { status: 'Completed' });
    });

    expect(onRefresh).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Job approved and marked as completed!');
  });

  it('rejects a job with prompt reason', async () => {
    V2.put.mockResolvedValue({});
    const onRefresh = jest.fn();
    window.prompt.mockReturnValue('Needs rework');

    renderView({ onRefresh });

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));

    expect(window.prompt).toHaveBeenCalled();

    await waitFor(() => {
      expect(V2.put).toHaveBeenCalledWith('/jobs/job-1/status', {
        status: 'In Progress',
        qcNotes: 'Needs rework'
      });
    });

    expect(onRefresh).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Job sent back for rework');
  });

  it('does nothing when reject prompt is cancelled', async () => {
    V2.put.mockResolvedValue({});
    window.prompt.mockReturnValue('');

    renderView();

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));

    expect(V2.put).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalledWith('Job sent back for rework');
  });
});
