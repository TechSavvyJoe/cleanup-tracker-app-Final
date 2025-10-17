import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { saveAs } from 'file-saver';

jest.mock('exceljs', () => {
  const writeBufferMock = jest.fn().mockResolvedValue(new ArrayBuffer(8));

  const workbookInstances = [];

  class Workbook {
    constructor() {
      this.sheets = {};
      this.addWorksheet = jest.fn((name) => {
        const sheet = {
          columns: undefined,
          addRows: jest.fn(),
          eachRow: jest.fn(),
          getRow: jest.fn(() => ({ font: {}, alignment: {}, eachCell: jest.fn(), border: undefined })),
          addRow: jest.fn()
        };
        this.sheets[name] = sheet;
        return sheet;
      });
      this.xlsx = { writeBuffer: writeBufferMock };
      workbookInstances.push(this);
    }
  }

  const mocks = {
    writeBufferMock,
    workbookInstances
  };

  return {
    __esModule: true,
    default: {
      Workbook,
      __mocks: mocks
    },
    Workbook,
    __mocks: mocks
  };
});

jest.mock('file-saver', () => ({
  saveAs: jest.fn()
}));

jest.mock('jspdf', () => {
  const mockInstance = {
    addImage: jest.fn(),
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    text: jest.fn(),
    autoTable: jest.fn(),
    internal: {
      pageSize: {
        getWidth: () => 800,
        getHeight: () => 600
      }
    },
    getNumberOfPages: jest.fn(() => 1),
    setPage: jest.fn(),
    save: jest.fn()
  };

  return jest.fn(() => mockInstance);
});

jest.mock('jspdf-autotable', () => ({}));

const SimpleReports = require('../SimpleReports').default;

let consoleLogSpy;
let consoleErrorSpy;

beforeAll(() => {
  window.alert = jest.fn();
});

beforeEach(() => {
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

const sampleJobs = [
  {
    id: 'job-1',
    status: 'Completed',
    serviceType: 'Cleanup',
    technicianName: 'Alex',
    vin: '12345678901234567',
    stockNumber: 'STK-100',
    location: 'Main lot',
    createdAt: '2024-04-01T10:00:00Z',
    completedAt: '2024-04-01T12:00:00Z'
  }
];

const sampleUsers = [
  { id: 'user-1', name: 'Manager' }
];

const reportsPayload = {
  periodTotal: 1,
  completed: 1,
  dailyTrends: [{ date: '2024-04-01', jobs: 1, completed: 1, completionRate: 100 }]
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(reportsPayload)
  }));
});

describe('SimpleReports', () => {
  it('exports Excel using exceljs workbook helpers', async () => {
    const excelModule = jest.requireMock('exceljs');

    render(<SimpleReports jobs={sampleJobs} users={sampleUsers} theme="dark" />);

    await screen.findByText(/Total Jobs/i);

    const exportButton = screen.getByRole('button', { name: /Excel/i });
    fireEvent.click(exportButton);

    const excelMocks = excelModule.__mocks;

    await waitFor(() => {
      expect(excelMocks.writeBufferMock).toHaveBeenCalled();
    });

    expect(saveAs).toHaveBeenCalled();
    const workbook = excelMocks.workbookInstances.at(-1);
    const jobsSheet = workbook.sheets['Jobs'];
    const summarySheet = workbook.sheets['Summary'];
    expect(jobsSheet.addRows).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ ID: 'job-1' })
    ]));
    expect(summarySheet.addRows).toHaveBeenCalled();
  });
});
