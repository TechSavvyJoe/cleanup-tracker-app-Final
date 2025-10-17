import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EnterpriseInventory from '../EnterpriseInventory';
import { v2Request } from '../../utils/v2Client';
import { DEFAULT_SERVICE_TYPES } from '../../utils/serviceTypes';

jest.mock('../../utils/v2Client', () => ({
  v2Request: jest.fn()
}));

jest.mock('../Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn()
  })
}));

const vehiclesMock = [
  {
    _id: 'veh-1',
    year: 2022,
    make: 'Ford',
    model: 'Lightning',
    trim: 'Lariat',
    color: 'Blue',
    status: 'AVAILABLE ',
    updatedAt: '2024-04-01T10:00:00.000Z',
    price: '47000',
    odometer: '12000',
    vin: '1234567890ABCDE1',
    stockNumber: 'F123',
    location: 'Front Line'
  },
  {
    _id: 'veh-2',
    year: 2019,
    make: 'Honda',
    model: 'Civic',
    trim: 'EX',
    color: 'Silver',
    status: 'sold',
    updatedAt: '2024-03-20T12:00:00.000Z',
    price: '21000',
    odometer: '45000',
    vin: '1234567890ABCDE2',
    stockNumber: 'H987',
    location: 'Back Lot'
  }
];

beforeEach(() => {
  jest.resetAllMocks();
  v2Request.mockImplementation((method) => {
    if (method === 'get') {
      return Promise.resolve({ data: vehiclesMock });
    }
    return Promise.resolve({ data: {} });
  });
});

describe('EnterpriseInventory', () => {
  it('filters vehicles with normalized status values', async () => {
    render(<EnterpriseInventory theme="dark" />);

    await screen.findByText(/Ford Lightning/i);

  const statusSelect = screen.getByLabelText(/Filter Status/i);
    fireEvent.change(statusSelect, { target: { value: 'available' } });

    expect(screen.getByText(/Ford Lightning/i)).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText(/Honda Civic/i)).toBeNull();
    });
  });

  it('sanitizes price and odometer values before updating a vehicle', async () => {
    const putResponses = [];
    v2Request.mockImplementation((method, url, data) => {
      if (method === 'get') {
        return Promise.resolve({ data: vehiclesMock });
      }
      if (method === 'put') {
        putResponses.push({ url, data });
        return Promise.resolve({ data: { ...vehiclesMock[0], ...data } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<EnterpriseInventory theme="dark" />);

    await screen.findByText(/Ford Lightning/i);

    fireEvent.click(screen.getByText(/Ford Lightning/i));

    const editButton = await screen.findByRole('button', { name: /Edit Vehicle Details/i });
    fireEvent.click(editButton);

    const priceInput = await screen.findByPlaceholderText('$42,500');
    const odometerInput = screen.getByPlaceholderText('48,200');

    fireEvent.change(priceInput, { target: { value: '52150.55' } });
    fireEvent.change(odometerInput, { target: { value: '1234 miles' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(putResponses.length).toBeGreaterThan(0);
    });

    const { url, data } = putResponses[0];
    expect(url).toBe('/vehicles/veh-1');
    expect(data).toMatchObject({
      price: '$52,151',
      odometer: '1,234'
    });
  });

  it('creates a job using the selected service catalog entry', async () => {
    const postRequests = [];
    v2Request.mockImplementation((method, url, data) => {
      if (method === 'get') {
        return Promise.resolve({ data: vehiclesMock });
      }
      if (method === 'post') {
        postRequests.push({ url, data });
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: {} });
    });

    render(<EnterpriseInventory theme="dark" />);

    const launchButtons = await screen.findAllByRole('button', { name: /Launch Job/i });
    fireEvent.click(launchButtons[0]);

    await waitFor(() => {
      expect(postRequests.length).toBeGreaterThan(0);
    });

    const { url, data } = postRequests[0];
    expect(url).toBe('/jobs');
    expect(data).toMatchObject({
      serviceType: DEFAULT_SERVICE_TYPES[0].name,
      expectedDuration: DEFAULT_SERVICE_TYPES[0].expectedMinutes
    });
  });
});
