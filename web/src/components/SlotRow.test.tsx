import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeSlot, renderWithRouter } from '../test-utils';
import type { SlotView } from '../types';
import { SlotRow } from './SlotRow';

function renderRow(slot: SlotView, { canBook = true, isReferent = false, onBook = () => {} } = {}) {
  return renderWithRouter(<SlotRow slot={slot} canBook={canBook} isReferent={isReferent} onBook={onBook} />);
}

describe('SlotRow', () => {
  it('shows the hours of the slot and the places left, and no registration', () => {
    renderRow(makeSlot({ hour: 11, remaining: 12 }));

    expect(screen.getByText('11:00 – 12:00')).toBeInTheDocument();
    expect(screen.getByText('12 places restantes')).toBeInTheDocument();
    expect(screen.queryByText(/Inscrit|En attente/)).not.toBeInTheDocument();
  });

  it('says "1 place restante" for the last place', () => {
    renderRow(makeSlot({ remaining: 1 }));

    expect(screen.getByText('1 place restante')).toBeInTheDocument();
  });

  it('offers to book a slot with places left', () => {
    renderRow(makeSlot({ remaining: 5 }));

    expect(screen.getByRole('button', { name: "S'inscrire" })).toBeEnabled();
  });

  it('shows a full slot with its waiting list, and offers to join it', () => {
    renderRow(makeSlot({ remaining: 0, waitingCount: 3 }));

    expect(screen.getByText('Complet · 3 en attente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Rejoindre la liste d'attente" })).toBeEnabled();
    expect(screen.queryByRole('button', { name: "S'inscrire" })).not.toBeInTheDocument();
  });

  it('disables the button of a slot that has started', () => {
    renderRow(makeSlot({ isPast: true }));

    expect(screen.getByRole('button', { name: "S'inscrire" })).toBeDisabled();
  });

  it('shows "Inscrit" for a slot held, and disables the button', () => {
    renderRow(makeSlot({ remaining: 11, myStatus: 'confirmed', myRegistrationId: 'r1' }));

    expect(screen.getByText('Inscrit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "S'inscrire" })).toBeDisabled();
  });

  it('shows the place in the waiting list, and disables the button', () => {
    renderRow(makeSlot({ remaining: 0, waitingCount: 2, myStatus: 'waiting', myPosition: 2, myRegistrationId: 'r1' }));

    expect(screen.getByText('En attente (n°2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Rejoindre la liste d'attente" })).toBeDisabled();
  });

  it('shows the own place in the waiting list, not its length', () => {
    renderRow(makeSlot({ remaining: 0, waitingCount: 5, myStatus: 'waiting', myPosition: 2, myRegistrationId: 'r1' }));

    expect(screen.getByText('En attente (n°2)')).toBeInTheDocument();
  });

  it('disables the button when the user cannot book', () => {
    renderRow(makeSlot(), { canBook: false });

    expect(screen.getByRole('button', { name: "S'inscrire" })).toBeDisabled();
  });

  it('calls onBook on a click on the button', async () => {
    const onBook = vi.fn();
    renderRow(makeSlot(), { onBook });

    await userEvent.click(screen.getByRole('button', { name: "S'inscrire" }));

    expect(onBook).toHaveBeenCalledOnce();
  });

  it('offers a referent to see who registered to the slot', () => {
    renderRow(makeSlot({ date: '2026-10-21', hour: 18 }), { isReferent: true });

    expect(screen.getByRole('link', { name: 'Voir les inscrits' })).toHaveAttribute(
      'href',
      '/referent/slots/2026-10-21/18',
    );
  });

  it('offers it for a slot that has started too', () => {
    renderRow(makeSlot({ isPast: true }), { isReferent: true });

    expect(screen.getByRole('link', { name: 'Voir les inscrits' })).toBeInTheDocument();
  });

  it('does not offer it to a student', () => {
    renderRow(makeSlot());

    expect(screen.queryByRole('link', { name: 'Voir les inscrits' })).not.toBeInTheDocument();
  });
});
