import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SalespersonDashboard from '../SalespersonDashboard';
import { V2 } from '../../../utils/v2Client';

jest.mock('../../../utils/v2Client', () => ({
  V2: {
    post: jest.fn()
  }
}));

jest.mock('../../../components/Toast', () => {
  const toast = {
    success: jest.fn(),
    error: jest.fn()
  };
  return {
    __esModule: true,
    useToast: () => toast,
    __toast: toast
  };
});

const user = {
  id: 'sales-1',
  name: 'Taylor Swift',
  employeeId: 'SP100',
  role: 'salesperson'
};

const jobs = [
  {
    id: 'job-1',
    status: 'QC Approved',
    serviceType: 'Cleanup',
    priority: 'Normal',
    updatedAt: '2024-04-02T10:00:00Z',
    vin: 'VIN00001',
    stockNumber: 'STK-01',
    vehicleColor: 'Red',
    make: 'Ford',
    model: 'Bronco',
    year: 2023,
    completedAt: '2024-04-02T10:30:00Z',
    salesPerson: 'Taylor Swift'
  },
  {
    id: 'job-2',
    status: 'QC Required',
    serviceType: 'Detail',
    priority: 'High',
    updatedAt: '2024-04-02T09:00:00Z',
    vin: 'VIN00002',
    stockNumber: 'STK-02',
    vehicleColor: 'Black',
    make: 'Tesla',
    model: 'Model 3',
    year: 2022,
    salesPerson: 'Taylor Swift'
  }
];

beforeEach(() => {
  jest.clearAllMocks();
  V2.post.mockResolvedValue({ data: {} });
});

describe('SalespersonDashboard', () => {
  it('treats QC Approved jobs as completed in metrics', async () => {
    render(<SalespersonDashboard user={user} jobs={jobs} />);

    await screen.findByText(/Sales Dashboard/i);

    expect(screen.getByRole('button', { name: /Completed 1/i })).toBeTruthy();

    const completedFilter = screen.getByRole('button', { name: /Completed 1/i });
    fireEvent.click(completedFilter);

    await waitFor(() => {
      expect(screen.getByText(/Ford Bronco/i)).toBeTruthy();
    });
  });

  it('submits QC approvals with salesperson identity', async () => {
    render(<SalespersonDashboard user={user} jobs={jobs} />);

    await screen.findByText(/Ford Bronco/i);

    // Open QC dialog for the first job and submit a passing QC.
    const passButton = screen.getByRole('button', { name: /Pass/i });
    fireEvent.click(passButton);

    // The dialog requires a PIN and then a submit. Fill PIN and submit.
    const pinInput = await screen.findByPlaceholderText(/Enter your QC PIN/i);
    fireEvent.change(pinInput, { target: { value: '1234' } });

    const submit = screen.getByRole('button', { name: /Submit QC/i });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(V2.post).toHaveBeenCalledWith('/jobs/job-1/qc', expect.objectContaining({
        qcCheckerId: user.employeeId,
        qcCheckerName: user.name,
        qcPassed: true
      }));
    });

    const { __toast } = require('../../../components/Toast');
    expect(__toast.success).toHaveBeenCalled();
  });
});
