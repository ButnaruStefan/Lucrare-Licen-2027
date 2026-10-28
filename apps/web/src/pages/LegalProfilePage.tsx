/**
 * Pagina profilului juridic al unui proiect (/proiecte/:projectId/profil-juridic):
 * chestionarul OUG 112/2018 si rezultatul evaluarii.
 *
 * - intrebarile vin de la API; unele apar doar in functie de raspunsuri (ex. intrebarile
 *   despre ONG-uri doar pentru ONG-uri), dupa aceeasi regula ca in API (`questionApplies`);
 * - fiecare intrebare e un grup de butoane radio (`fieldset` + `legend`), cu textul de ajutor
 *   si eroarea legate prin aria-describedby;
 * - raspunsurile sunt verificate inainte de trimitere; la eroare, focusul merge pe prima
 *   intrebare fara raspuns;
 * - dupa salvare, focusul merge pe titlul rezultatului, ca sa fie anuntat de cititorul de ecran.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  legalProfileAnswersSchema,
  questionApplies,
  type LegalProfile,
  type LegalProfileAnswers,
  type Question,
  type QuestionId,
} from '@ro-a11y/shared';
import { ApiRequestError } from '../api/client';
import { useLegalProfile, useProject, useSaveLegalProfile } from '../api/queries';
import { ErrorMessage, Loading } from '../components/Feedback';
import { LegalAssessmentView } from '../components/LegalAssessmentView';
import { PageHeading } from '../components/PageHeading';
import { useFocusFirstInvalid } from '../lib/focus';

type Draft = Partial<Record<QuestionId, string>>;

export function LegalProfilePage() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);
  const legalProfile = useLegalProfile(projectId);

  if (project.isPending || legalProfile.isPending) {
    return <Loading label="Se încarcă profilul juridic..." />;
  }
  if (project.isError || legalProfile.isError) {
    const error = project.error ?? legalProfile.error;
    const notFound = error instanceof ApiRequestError && error.status === 404;
    return (
      <>
        <PageHeading title={notFound ? 'Proiectul nu există' : 'Eroare'} />
        <ErrorMessage error={error} />
        <p>
          <Link to="/">Înapoi la proiecte</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="breadcrumb">
        <Link to="/">Proiecte</Link> <span aria-hidden="true">›</span>{' '}
        <Link to={`/proiecte/${projectId}`}>{project.data.name}</Link>{' '}
        <span aria-hidden="true">›</span> Profil juridic
      </p>
      <PageHeading title="Profil juridic: OUG 112/2018" />
      <p className="lead">
        Câteva întrebări despre cine administrează site-ul arată dacă OUG nr. 112/2018 (legea
        accesibilității site-urilor din sectorul public) ar putea să se aplice. Evaluarea este
        informativă: se bazează doar pe răspunsurile tale și nu este o concluzie juridică.
      </p>

      <LegalProfileForm
        projectId={projectId}
        questions={legalProfile.data.questions}
        saved={legalProfile.data.profile}
      />
    </>
  );
}

function LegalProfileForm({
  projectId,
  questions,
  saved,
}: {
  projectId: string;
  questions: Question[];
  saved: LegalProfile | null;
}) {
  const save = useSaveLegalProfile(projectId);
  const [draft, setDraft] = useState<Draft>(() => ({ ...(saved?.answers ?? {}) }));
  const [errors, setErrors] = useState<Partial<Record<QuestionId, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const [justSaved, setJustSaved] = useState(false);
  // Creste la fiecare trimitere cu erori: muta focusul pe prima intrebare fara raspuns.
  const [failedSubmits, setFailedSubmits] = useState(0);
  useFocusFirstInvalid(formRef, failedSubmits);

  const visible = questions.filter((q) =>
    questionApplies(q.id, {
      organizationType: draft.organizationType as LegalProfileAnswers['organizationType'],
    }),
  );

  useEffect(() => {
    if (justSaved) resultHeadingRef.current?.focus();
  }, [justSaved]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setJustSaved(false);
    const parsed = legalProfileAnswersSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      setFailedSubmits((n) => n + 1);
      return;
    }
    setErrors({});
    save.mutate(parsed.data, {
      onSuccess: () => setJustSaved(true),
      onError: (error) => {
        if (error instanceof ApiRequestError && error.details.length > 0) {
          setErrors(Object.fromEntries(error.details.map((d) => [d.field, d.message])));
          setFailedSubmits((n) => n + 1);
        }
      },
    });
  }

  const profile = save.data ?? saved;
  const generalError =
    save.error && !(save.error instanceof ApiRequestError && save.error.details.length > 0)
      ? save.error
      : null;

  return (
    <>
      {profile && (
        <section aria-labelledby="rezultat-profil" className="section card">
          <h2 id="rezultat-profil" ref={resultHeadingRef} tabIndex={-1}>
            Rezultatul evaluării
          </h2>
          <LegalAssessmentView profile={profile} />
        </section>
      )}

      <section aria-labelledby="chestionar" className="section card">
        <h2 id="chestionar">{profile ? 'Modifică răspunsurile' : 'Chestionar'}</h2>
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          {generalError && <ErrorMessage error={generalError} title="Profilul nu a fost salvat" />}
          {visible.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={draft[question.id]}
              error={errors[question.id]}
              onChange={(value) => {
                setDraft((d) => ({ ...d, [question.id]: value }));
                setErrors((e) => ({ ...e, [question.id]: undefined }));
              }}
            />
          ))}
          <button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Se evaluează...' : 'Evaluează și salvează'}
          </button>
        </form>
      </section>
    </>
  );
}

function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: Question;
  value: string | undefined;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const helpId = `intrebare-${question.id}-ajutor`;
  const errorId = `intrebare-${question.id}-eroare`;

  return (
    <fieldset
      className="question"
      aria-describedby={[helpId, error ? errorId : null].filter(Boolean).join(' ')}
    >
      <legend className="question__text">{question.text}</legend>
      <p id={helpId} className="field__hint">
        {question.help} <span className="question__ref">({question.articleRef})</span>
      </p>
      {error && (
        <p id={errorId} className="field__error">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
      <div className="question__options">
        {question.options.map((option) => {
          const id = `intrebare-${question.id}-${option.value}`;
          const optionHelpId = `${id}-ajutor`;
          return (
            <div key={option.value} className="field--radio">
              <input
                id={id}
                type="radio"
                name={question.id}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={option.help ? optionHelpId : undefined}
              />
              <label htmlFor={id}>{option.label}</label>
              {option.help && (
                <p id={optionHelpId} className="field__hint question__option-help">
                  {option.help}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
