import { PROJECT_TYPES, FEATURES, PACES, estimate, money, YEAR_FRACTIONS } from '../quote.js';

export default function QuoteEngine({ value, onChange, onRequest }) {
  const { typeId, featureIds, paceId } = value;
  const result = estimate(value);

  const set = (patch) => onChange({ ...value, ...patch });
  const toggleFeature = (id) =>
    set({ featureIds: featureIds.includes(id) ? featureIds.filter((x) => x !== id) : [...featureIds, id] });

  return (
    <div className="quote">
      <div className="quote-inputs">
        <fieldset>
          <legend>What are we building?</legend>
          <div className="choice-grid">
            {PROJECT_TYPES.map((t) => (
              <label key={t.id} className={`choice ${typeId === t.id ? 'is-on' : ''}`}>
                <input type="radio" name="type" checked={typeId === t.id} onChange={() => set({ typeId: t.id })} />
                <span className="choice-title">{t.label}</span>
                <span className="choice-detail">{t.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>What does it need?</legend>
          <div className="check-list">
            {FEATURES.map((f) => (
              <label key={f.id} className="check">
                <input type="checkbox" checked={featureIds.includes(f.id)} onChange={() => toggleFeature(f.id)} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>How fast?</legend>
          <div className="pace-row">
            {PACES.map((p) => (
              <label key={p.id} className={`choice choice-small ${paceId === p.id ? 'is-on' : ''}`}>
                <input type="radio" name="pace" checked={paceId === p.id} onChange={() => set({ paceId: p.id })} />
                <span className="choice-title">{p.label}</span>
                <span className="choice-detail">{p.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <aside className="quote-result" aria-live="polite">
        {!result ? (
          <p className="quote-empty">Pick what you're building to see an estimate.</p>
        ) : (
          <>
            <p className="result-kicker">Estimated range</p>
            <p className="result-price">
              {money(result.price[0])}<span> to </span>{money(result.price[1])}
            </p>
            <div className="year-meter" role="img" aria-label={`About ${result.fraction.label} of a working year`}>
              <div className="year-fill" style={{ width: `${Math.min(100, result.share * 100)}%` }} />
              {YEAR_FRACTIONS.slice(2).map((f) => (
                <span key={f.label} className="year-tick" style={{ left: `${f.value * 100}%` }} />
              ))}
            </div>
            <p className="result-share">
              About <strong>{result.fraction.label}</strong> of my working year, {result.fraction.words} of full-time work.
            </p>
            <dl className="result-facts">
              <div><dt>Calendar time</dt><dd>{result.weeks[0]}–{result.weeks[1]} weeks at a {result.pace.label.toLowerCase()} pace</dd></div>
              <div><dt>Work</dt><dd>{result.hours[0]}–{result.hours[1]} hours</dd></div>
            </dl>
            <p className="result-note">
              A starting point, not an invoice. Your real quote comes after a short scope call, in writing, before any work begins.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => onRequest(result)}>
              Send this with my request
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
