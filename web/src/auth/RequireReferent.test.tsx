import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeToken } from '../test-utils';
import { AuthProvider, TOKEN_KEY } from './AuthProvider';
import { RequireReferent } from './RequireReferent';

// No route uses it yet: the referent pages come later.
function renderReferentPage(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  return render(
    <AuthProvider>
      <RequireReferent>
        <h2>Page des référents</h2>
      </RequireReferent>
    </AuthProvider>,
  );
}

describe('RequireReferent', () => {
  it('shows the page to a referent', () => {
    renderReferentPage(makeToken({ email: 'referent1@castelmont.fr', role: 'referent' }));

    expect(screen.getByRole('heading', { name: 'Page des référents' })).toBeInTheDocument();
    expect(screen.queryByText('Page réservée aux référents.')).not.toBeInTheDocument();
  });

  it('shows a notice to a student instead of the page', () => {
    renderReferentPage(makeToken());

    expect(screen.getByText('Page réservée aux référents.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page des référents' })).not.toBeInTheDocument();
  });
});
