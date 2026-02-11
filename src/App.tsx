import React, { useState, useRef } from 'react';
import './style.css';

const partenaireImg =
  'https://www.figma.com/api/mcp/asset/ca123981-2c7f-4910-bf04-4ce572dd615b';

// URL de l'API d'envoi d'e-mail
// En développement : http://localhost:3001 (via `npm run server` ou `npm run start`)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Service = 'logo' | 'webapp' | 'visuals';
type LogoStep = 1 | 2 | 3 | 4;

export const App: React.FC = () => {
  const [service, setService] = useState<Service>('logo');
  const [logoStep, setLogoStep] = useState<LogoStep>(1);
  const [exemplaireFiles, setExemplaireFiles] = useState<File[]>([]);
  const exemplaireInputRef = useRef<HTMLInputElement>(null);
  const formDataRef = useRef<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const t = e.target;
    if (t.type === 'file' && t instanceof HTMLInputElement) {
      formDataRef.current[t.id] = t.files
        ? Array.from(t.files)
            .map((f) => f.name)
            .join(', ')
        : '';
    } else {
      formDataRef.current[t.id] = t.value;
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...formDataRef.current,
        exemplaireFileNames: exemplaireFiles.map((f) => f.name),
      };
      const res = await fetch(`${API_URL}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: { message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: res.ok ? '' : text || `Erreur ${res.status}` };
      }
      if (!res.ok) {
        const msg =
          data.message ||
          (res.status === 404 || res.status === 502
            ? 'API non disponible. Lancez « npm run start » dans un terminal (site + serveur d’envoi), puis réessayez.'
            : `Erreur ${res.status}`);
        throw new Error(msg);
      }
      setSubmitSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de l’envoi.';
      const needStart =
        message.includes('Failed to fetch') ||
        message.includes('Connection refused') ||
        message.includes('NetworkError') ||
        message.includes('API non disponible') ||
        message.includes('npm run start');
      setSubmitError(
        needStart
          ? 'Serveur d’envoi injoignable. Lancez « npm run start » dans un terminal (pour démarrer le site + l’API), puis réessayez.'
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-gradient" />

      <header className="site-header" aria-label="En-tête du site">
        <div className="site-header-inner">
          <a href="/" className="site-header-logo">
            <img
              src="/Logo viviworks.ai.png"
              alt=""
              className="site-header-logo-icon"
              width={32}
              height={32}
            />
            <span className="site-header-logo-text">
              viviworks<span className="site-header-logo-accent">.ai</span>
            </span>
          </a>
        </div>
      </header>

      <div className="page-content">
        <section className="hero">
          <header className="hero-header">
            <p className="hero-kicker">Questionnaire</p>
            <h1 className="hero-title">
              Questionnaire <span>Complet</span>
            </h1>
            <p className="hero-subtitle">
              Créez votre identité visuelle et vos applications
            </p>
          </header>

          <div className="hero-partner">
            <img src={partenaireImg} alt="Partenaires" />
          </div>

          <a
            className="hero-cta"
            href="https://portfolio.viviworks.ai/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir notre portfolio
          </a>
        </section>

        <section className="form-card" aria-label="Questionnaire de brief">
          <div className="form-card-backdrop" aria-hidden>
            <img
              src="/Logo viviworks.ai (1).png"
              alt=""
              className="form-card-backdrop-logo"
            />
          </div>
          <div className="form-card-glow form-card-glow-top" />
          <div className="form-card-glow form-card-glow-bottom" />

          <div className="form-scroll">
            <section className="form-section">
              <p className="form-section-kicker">Informations Générales</p>

              <div className="form-field">
                <label className="field-label" htmlFor="email">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  className="text-input"
                  placeholder="Votre adresse e-mail"
                  onChange={handleFormChange}
                />
              </div>

              <div className="form-field">
                <label className="field-label" htmlFor="fullname">
                  Nom et prénom
                </label>
                <input
                  id="fullname"
                  type="text"
                  className="text-input"
                  placeholder="Votre nom complet"
                  onChange={handleFormChange}
                />
              </div>

              <div className="form-field">
                <label className="field-label" htmlFor="company">
                  Nom de l&apos;entreprise / projet
                </label>
                <input
                  id="company"
                  type="text"
                  className="text-input"
                  placeholder="Le nom de votre entreprise"
                  onChange={handleFormChange}
                />
              </div>
            </section>

            <section className="form-section">
              <h2 className="form-section-title">Choisissez votre service</h2>

              <div className="service-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={service === 'logo'}
                  className={
                    service === 'logo'
                      ? 'service-tab service-tab-active'
                      : 'service-tab'
                  }
                  onClick={() => setService('logo')}
                >
                  Logo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={service === 'webapp'}
                  className={
                    service === 'webapp'
                      ? 'service-tab service-tab-active'
                      : 'service-tab'
                  }
                  onClick={() => setService('webapp')}
                >
                  Application Web
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={service === 'visuals'}
                  className={
                    service === 'visuals'
                      ? 'service-tab service-tab-active'
                      : 'service-tab'
                  }
                  onClick={() => setService('visuals')}
                >
                  Visuels
                </button>
              </div>
            </section>

            <section className="form-section">
              <p className="form-section-kicker">Section Logo</p>

              <div className="stepper" aria-label="Étapes du questionnaire">
                <div className="stepper-track">
                  <div
                    className="stepper-track-active"
                    style={{ width: `${(logoStep / 4) * 100}%` }}
                  />
                </div>
                <div className="stepper-steps">
                  <button
                    type="button"
                    className={
                      logoStep >= 1
                        ? 'stepper-step stepper-step-active'
                        : 'stepper-step'
                    }
                    onClick={() => setLogoStep(1)}
                  >
                    <span className="stepper-dot" />
                    <span className="stepper-label">À propos logo</span>
                  </button>
                  <button
                    type="button"
                    className={
                      logoStep >= 2
                        ? 'stepper-step stepper-step-active'
                        : 'stepper-step'
                    }
                    onClick={() => setLogoStep(2)}
                  >
                    <span className="stepper-dot" />
                    <span className="stepper-label">Naissance d’idée</span>
                  </button>
                  <button
                    type="button"
                    className={
                      logoStep >= 3
                        ? 'stepper-step stepper-step-active'
                        : 'stepper-step'
                    }
                    onClick={() => setLogoStep(3)}
                  >
                    <span className="stepper-dot" />
                    <span className="stepper-label">Client cible</span>
                  </button>
                  <button
                    type="button"
                    className={
                      logoStep >= 4
                        ? 'stepper-step stepper-step-active'
                        : 'stepper-step'
                    }
                    onClick={() => setLogoStep(4)}
                  >
                    <span className="stepper-dot" />
                    <span className="stepper-label">Exemplaire</span>
                  </button>
                </div>
              </div>

              {logoStep === 1 && (
                <>
                  <div className="form-field">
                    <label className="field-label" htmlFor="sector">
                      Secteur d&apos;activité
                    </label>
                    <select
                      id="sector"
                      className="select-input"
                      defaultValue=""
                      onChange={handleFormChange}
                    >
                      <option value="" disabled>
                        -- Sélectionnez --
                      </option>
                      <option value="tech">Technologie</option>
                      <option value="sante">Santé</option>
                      <option value="education">Éducation</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="style">
                      Style de logo préféré
                    </label>
                    <select
                      id="style"
                      className="select-input"
                      defaultValue=""
                      onChange={handleFormChange}
                    >
                      <option value="" disabled>
                        -- Sélectionnez --
                      </option>
                      <option value="minimaliste">Minimaliste</option>
                      <option value="moderne">Moderne</option>
                      <option value="classique">Classique</option>
                      <option value="illustratif">Illustratif</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="wantedColors">
                      Couleurs souhaitées
                    </label>
                    <input
                      id="wantedColors"
                      type="text"
                      className="text-input"
                      placeholder="Ex: Bleu, blanc, gris"
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="avoidColors">
                      Couleurs à éviter
                    </label>
                    <input
                      id="avoidColors"
                      type="text"
                      className="text-input"
                      placeholder="Ex: Rouge, orange"
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="letters">
                      Préférez-vous que les lettres du logo soient :
                    </label>
                    <select
                      id="letters"
                      className="select-input"
                      defaultValue=""
                      onChange={handleFormChange}
                    >
                      <option value="" disabled>
                        -- Sélectionnez --
                      </option>
                      <option value="majuscules">En majuscules</option>
                      <option value="minuscules">En minuscules</option>
                      <option value="mixte">
                        Majuscules &amp; minuscules
                      </option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="message">
                      Message ou feeling à transmettre
                    </label>
                    <textarea
                      id="message"
                      className="textarea-input"
                      placeholder="Décrivez le message ou le ressenti que vous souhaitez transmettre avec ce logo..."
                      rows={4}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="file">
                      Fichier de référence (optionnel)
                    </label>
                    <p className="field-hint">
                      Ajoutez une image ou un PDF pour illustrer vos attentes
                    </p>

                    <label className="file-input-wrapper">
                      <input
                        id="file"
                        type="file"
                        className="file-input-hidden"
                        onChange={handleFormChange}
                      />
                      <span className="file-button">Choose File</span>
                      <span className="file-name">No file chosen</span>
                    </label>
                  </div>
                </>
              )}

              {logoStep === 2 && (
                <>
                  <div className="form-field">
                    <label className="field-label" htmlFor="birth">
                      Comment est née votre entreprise ?
                    </label>
                    <textarea
                      id="birth"
                      className="textarea-input"
                      rows={3}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="anecdote">
                      Y a-t-il une anecdote ou un moment fondateur qui vous
                      définit ?
                    </label>
                    <textarea
                      id="anecdote"
                      className="textarea-input"
                      rows={3}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="person">
                      Si votre marque était une personne, comment la
                      décririez-vous ?
                    </label>
                    <textarea
                      id="person"
                      className="textarea-input"
                      rows={3}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="images">
                      Quels mots ou images viennent à l’esprit quand vous
                      pensez à votre marque idéale ?
                    </label>
                    <textarea
                      id="images"
                      className="textarea-input"
                      rows={3}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="summary">
                      Comment décririez-vous votre entreprise en quelques mots
                      ?
                    </label>
                    <textarea
                      id="summary"
                      className="textarea-input"
                      rows={3}
                      onChange={handleFormChange}
                    />
                  </div>
                </>
              )}

              {logoStep === 3 && (
                <>
                  <div className="form-field">
                    <label className="field-label" htmlFor="idealClients">
                      Qui sont vos clients idéaux ?
                    </label>
                    <textarea
                      id="idealClients"
                      className="textarea-input"
                      rows={3}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="problems">
                      Quels problèmes ou besoins résolvez-vous pour eux ?
                    </label>
                    <textarea
                      id="problems"
                      className="textarea-input"
                      rows={3}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="difference">
                      Qu’est-ce qui vous distingue de vos concurrents ?
                    </label>
                    <textarea
                      id="difference"
                      className="textarea-input"
                      rows={3}
                      onChange={handleFormChange}
                    />
                  </div>
                </>
              )}

              {logoStep === 4 && (
                <>
                  <div className="form-field">
                    <label className="field-label" htmlFor="visualType">
                      Type de visuel
                    </label>
                    <select
                      id="visualType"
                      className="select-input"
                      defaultValue=""
                      onChange={handleFormChange}
                    >
                      <option value="" disabled>
                        -- Sélectionnez --
                      </option>
                      <option value="post">Post réseaux sociaux</option>
                      <option value="affiche">Affiche / Flyer</option>
                      <option value="banniere">Bannière web</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="visualSector">
                      Secteur d&apos;activité
                    </label>
                    <select
                      id="visualSector"
                      className="select-input"
                      defaultValue=""
                      onChange={handleFormChange}
                    >
                      <option value="" disabled>
                        -- Sélectionnez --
                      </option>
                      <option value="tech">Technologie</option>
                      <option value="sante">Santé</option>
                      <option value="education">Éducation</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="visualBrand">
                      Nom de l&apos;entreprise / marque
                    </label>
                    <input
                      id="visualBrand"
                      type="text"
                      className="text-input"
                      placeholder="Ex: Bleu, blanc, gris"
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="visualGoal">
                      Quel est l&apos;objectif principal du visuel ?
                    </label>
                    <input
                      id="visualGoal"
                      type="text"
                      className="text-input"
                      placeholder="Ex: Rouge, orange"
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label" htmlFor="visualUploads">
                      Importez des modele de design que vous aimez
                    </label>
                    <div className="upload-area-wrapper">
                      <input
                        ref={exemplaireInputRef}
                        id="visualUploads"
                        type="file"
                        accept="image/*"
                        multiple
                        className="upload-area-input-hidden"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files?.length) {
                            setExemplaireFiles(Array.from(files));
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="upload-area"
                        onClick={() => exemplaireInputRef.current?.click()}
                      >
                        <div className="upload-placeholder-icon" />
                        <p className="upload-placeholder-text">
                          {exemplaireFiles.length > 0
                            ? `${exemplaireFiles.length} image(s) sélectionnée(s)`
                            : 'Cliquez ou déposez des images ici'}
                        </p>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          {submitSuccess && (
            <p className="form-message form-message-success">
              Merci. Votre formulaire a bien été envoyé.
            </p>
          )}
          {submitError && (
            <p className="form-message form-message-error">{submitError}</p>
          )}
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() =>
              logoStep < 4
                ? setLogoStep((current) => (current + 1) as LogoStep)
                : handleSubmit()
            }
          >
            {submitting
              ? 'Envoi en cours…'
              : logoStep < 4
                ? 'Suivant'
                : 'Terminé'}
          </button>
        </section>
      </div>
    </div>
  );
};

export default App;

