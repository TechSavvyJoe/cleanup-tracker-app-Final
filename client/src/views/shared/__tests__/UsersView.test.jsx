import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UsersView from '../UsersView';
import { V2 } from '../../../utils/v2Client';
import { ToastProvider } from '../../../components/Toast';

jest.mock('../../../utils/v2Client', () => ({
  V2: {
    post: jest.fn()
  }
}));

describe('UsersView', () => {
  const detailers = [
    { id: '1', name: 'Detailer One', role: 'detailer', pin: '1111', phone: '5551234567' },
    { id: '2', name: 'Manager Mary', role: 'manager', pin: '2222' }
  ];

  let originalLocation;

  beforeAll(() => {
    originalLocation = window.location;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    window.open = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: jest.fn() }
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
  });

  const renderView = (props = {}) =>
    render(
      <ToastProvider>
        <UsersView
          users={props.users || []}
          detailers={props.detailers || detailers}
          onDeleteUser={props.onDeleteUser || jest.fn()}
        />
      </ToastProvider>
    );

  it('renders detailers and forwards delete actions', () => {
    const onDeleteUser = jest.fn();
    renderView({ onDeleteUser });

    screen.getByText('Detailer One');
    screen.getByText('Manager Mary');

    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);

    expect(onDeleteUser).toHaveBeenCalledWith('1');
  });

  it('submits a new user and reloads on success', async () => {
    V2.post.mockResolvedValue({});

    renderView();

    fireEvent.change(screen.getByPlaceholderText('Full Name'), {
      target: { value: 'New Detailer' }
    });
    fireEvent.change(screen.getByPlaceholderText('4-Digit PIN'), {
      target: { value: '9876' }
    });
    fireEvent.change(screen.getByPlaceholderText('Phone Number (optional)'), {
      target: { value: '5557654321' }
    });
    const roleSelect = screen.getByRole('combobox');
    fireEvent.change(roleSelect, {
      target: { value: 'manager' }
    });

    fireEvent.click(screen.getByRole('button', { name: /add member/i }));

    await waitFor(() => {
      expect(V2.post).toHaveBeenCalledWith('/users', {
        name: 'New Detailer',
        pin: '9876',
        role: 'manager',
        phoneNumber: '5557654321'
      });
    });

    // Check that success toast is shown
    await waitFor(() => {
      expect(screen.getByText(/New Detailer added successfully as manager/i)).toBeTruthy();
    });

    await waitFor(() => expect(screen.getByPlaceholderText('Full Name').value).toBe(''));
    await waitFor(() => expect(screen.getByPlaceholderText('4-Digit PIN').value).toBe(''));
    await waitFor(() => expect(screen.getByPlaceholderText('Phone Number (optional)').value).toBe(''));
    await waitFor(() => expect(roleSelect.value).toBe('detailer'));
  });

  it('prevents submission when PIN is not 4 digits', () => {
    renderView();

    fireEvent.change(screen.getByPlaceholderText('Full Name'), {
      target: { value: 'Short Pin' }
    });
    fireEvent.change(screen.getByPlaceholderText('4-Digit PIN'), {
      target: { value: '12' }
    });

    // Button should be disabled when PIN is not 4 digits
    const submitButton = screen.getByRole('button', { name: /add member/i });
    expect(submitButton.disabled).toBe(true);
    expect(V2.post).not.toHaveBeenCalled();
  });

  it('shows an error message when the API request fails', async () => {
    V2.post.mockRejectedValue(new Error('Network down'));

    renderView();

    fireEvent.change(screen.getByPlaceholderText('Full Name'), {
      target: { value: 'Error User' }
    });
    fireEvent.change(screen.getByPlaceholderText('4-Digit PIN'), {
      target: { value: '1234' }
    });

    fireEvent.click(screen.getByRole('button', { name: /add member/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to add user: Network down/i)).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: /add member/i }).disabled).toBe(false);
  });

  it('opens the SMS composer when pressing Send SMS', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: /send sms/i }));

    const expectedMessage = 'Hi Detailer One, you have a new job assignment. Please check the system for details.';
    expect(window.open).toHaveBeenCalledWith(
      `sms:5551234567?body=${encodeURIComponent(expectedMessage)}`,
      '_blank'
    );
  });
});
