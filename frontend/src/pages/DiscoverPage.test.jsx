import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DiscoverPage from './DiscoverPage.jsx';
import { apiRequest } from '../services/api.js';

vi.mock('../services/api.js', () => ({ apiRequest: vi.fn() }));

const clinicSamples = [
  {
    _id: 'clinic-general', name: 'Asha Family Health Centre',
    description: 'Routine family consultations and general care.', address: 'Model Town, Phagwara',
    category: { _id: 'category-general', name: 'General care' }, averageServiceDurationMinutes: 8,
    queue: { waitingCount: 2, estimatedWaitMinutes: 16 }, isDemo: true,
  },
  {
    _id: 'clinic-dental', name: 'Sukh Dental Studio',
    description: 'Preventive dental care and check-ups.', address: 'Green Avenue, Phagwara',
    category: { _id: 'category-dental', name: 'Dental' }, averageServiceDurationMinutes: 15,
    queue: { waitingCount: 1, estimatedWaitMinutes: 15 }, isDemo: true,
  },
];

function renderDirectory() {
  return render(<MemoryRouter><DiscoverPage /></MemoryRouter>);
}

beforeEach(() => {
  apiRequest.mockResolvedValue({ clinics: clinicSamples });
});

afterEach(() => cleanup());

describe('public clinic directory', () => {
  it('searches clinic names, descriptions, and addresses', async () => {
    renderDirectory();
    expect(await screen.findByRole('link', { name: 'Asha Family Health Centre' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Green Avenue' } });
    expect(screen.getByRole('link', { name: 'Sukh Dental Studio' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Asha Family Health Centre' })).not.toBeInTheDocument();
  });

  it('filters clinics by category and restores all categories', async () => {
    renderDirectory();
    await screen.findByRole('link', { name: 'Asha Family Health Centre' });
    fireEvent.click(screen.getByRole('button', { name: 'Dental' }));
    expect(screen.getByRole('link', { name: 'Sukh Dental Studio' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Asha Family Health Centre' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All categories' }));
    expect(screen.getByRole('link', { name: 'Asha Family Health Centre' })).toBeInTheDocument();
  });

  it('shows a useful message when the clinic API fails', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Could not reach QueueSaathi. Check your connection and try again.'));
    renderDirectory();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach queuesaathi/i);
    await waitFor(() => expect(screen.queryByText('Loading clinics…')).not.toBeInTheDocument());
  });
});
