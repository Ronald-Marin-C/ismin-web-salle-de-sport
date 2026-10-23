import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { ApiError, searchStudents, validateInitiation } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { formatDate } from '../format';
import type { Student } from '../types';

// The most GET /users returns: with as many, other students may match.
const MAX_SEARCH_RESULTS = 50;

/** A 404 carries a message of the API, in French: the account no longer exists. */
function describeValidationError(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) return error.details.join(' ');
  return `Validation impossible : ${error instanceof Error ? error.message : String(error)}`;
}

/** Finding a student and validating their initiation, at /referent/initiations. */
export const ReferentInitiationsPage = () => {
  const { token, endSession } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  // undefined until the first search: nothing is asked before.
  const [search, setSearch] = useState<string>();
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState('');

  const { data: students, error, isLoading, isError } = useQuery({
    queryKey: ['students', token, search],
    queryFn: () => searchStudents(search!, token!),
    enabled: search !== undefined,
  });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(text.trim());
  };

  const validate = async (student: Student) => {
    setValidating(true);
    setValidationError('');
    try {
      await validateInitiation(student.id, token!);
      // Awaited: the buttons stay disabled until the list shows the validation.
      await queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        endSession();
        return;
      }
      setValidationError(describeValidationError(err));
    } finally {
      setValidating(false);
    }
  };

  return (
    <section className="page">
      <h2>Initiations</h2>

      <form className="search" role="search" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="student-search">Rechercher un élève</label>
          <input
            id="student-search"
            name="search"
            type="search"
            maxLength={100}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <button className="button" type="submit">
          Rechercher
        </button>
      </form>

      {/* isLoading, not isPending: a query not sent yet is pending too. */}
      {isLoading && (
        <p className="status" role="status">
          Chargement…
        </p>
      )}
      {isError && (
        <div className="error" role="alert">
          <span>Impossible de charger les élèves : {error.message}</span>
        </div>
      )}
      {validationError && (
        <div className="error" role="alert">
          <span>{validationError}</span>
        </div>
      )}
      {students?.length === 0 && <p className="empty">Aucun élève ne correspond à cette recherche.</p>}
      {students?.length === MAX_SEARCH_RESULTS && (
        <p className="hint">{`${MAX_SEARCH_RESULTS} élèves affichés au maximum : précisez la recherche.`}</p>
      )}
      {students && students.length > 0 && (
        <ul className="person-list">
          {students.map((student) => (
            <li key={student.id}>
              <div className="person">
                <span className="person-name">{`${student.firstName} ${student.lastName}`}</span>
                <span className="person-email">{student.email}</span>
                {student.initiationValidatedAt ? (
                  <span className="badge">{`Initiation validée le ${formatDate(student.initiationValidatedAt)}`}</span>
                ) : (
                  <button className="button" type="button" disabled={validating} onClick={() => validate(student)}>
                    Valider l'initiation
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
