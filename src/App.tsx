import React, { useState, useRef } from 'react';
import './style.css';

const partenaireImg =
  'https://www.figma.com/api/mcp/asset/ca123981-2c7f-4910-bf04-4ce572dd615b';

// URL de l'API d'envoi d'e-mail
// En développement : http://localhost:3001 (via `npm run server` ou `npm run start`)
// En production (Netlify) : URL relative → /api/submit (redirigé vers Netlify Function)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

type Service = 'logo' | 'webapp' | 'visuel';

export const App: React.FC = () => {
  const [service, setService] = useState<Service>('logo');
  const formDataRef = useRef<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFilesRef = useRef<File[]>([]);
  const exemplaireFileInputRef = useRef<HTMLInputElement>(null);
  const selectedExemplaireFilesRef = useRef<File[]>([]);
  const [referenceFileLabel, setReferenceFileLabel] = useState<string>('');
  const [exemplaireFileLabel, setExemplaireFileLabel] = useState<string>('');
  const [logoStep, setLogoStep] = useState(0);
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
      const files = t.files ? Array.from(t.files) : [];
      if (t.id === 'file') {
        selectedFilesRef.current = files;
        setReferenceFileLabel(files.length ? (files.length > 1 ? `${files.length} fichiers` : (files[0].name.length > 25 ? files[0].name.slice(0, 22) + '...' + files[0].name.slice(files[0].name.lastIndexOf('.')) : files[0].name)) : '');
        delete formDataRef.current[t.id];
      } else if (t.id === 'exemplaire') {
        selectedExemplaireFilesRef.current = files;
        setExemplaireFileLabel(files.length ? (files.length > 1 ? `${files.length} fichiers` : (files[0].name.length > 25 ? files[0].name.slice(0, 22) + '...' + files[0].name.slice(files[0].name.lastIndexOf('.')) : files[0].name)) : '');
        delete formDataRef.current[t.id];
      } else {
        const names = files.map((f) => f.name).join(', ');
        formDataRef.current[t.id] = names;
      }
    } else if (t.type === 'checkbox' && t instanceof HTMLInputElement) {
      formDataRef.current[t.id] = t.checked ? 'true' : 'false';
    } else {
      formDataRef.current[t.id] = t.value;
    }
  };

  const handleSubmit = async () => {
    // Vérification immédiate : ne jamais envoyer sans email valide
    const emailInput = document.getElementById('email') as HTMLInputElement | null;
    const emailValue = (emailInput?.value ?? '').trim();
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setSubmitError(
        !emailValue
          ? 'Veuillez renseigner votre adresse e-mail (champ en haut du formulaire).'
          : 'Adresse e-mail invalide.',
      );
      emailInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      emailInput?.focus();
      return;
    }

    setSubmitError(null);

    // Synchroniser les champs depuis le DOM (autocomplétion, etc.)
    const emailEl = document.getElementById('email') as HTMLInputElement | null;
    if (emailEl) formDataRef.current.email = emailEl.value;
    const fullnameEl = document.getElementById('fullname') as HTMLInputElement | null;
    if (fullnameEl) formDataRef.current.fullname = fullnameEl.value;
    const companyEl = document.getElementById('company') as HTMLInputElement | null;
    if (companyEl) formDataRef.current.company = companyEl.value;

    const email = (formDataRef.current?.email || '').trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      setSubmitError(
        email.length === 0
          ? 'Veuillez renseigner votre adresse e-mail (champ en haut du formulaire).'
          : 'Adresse e-mail invalide.',
      );
      emailEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      emailEl?.focus();
      return;
    }

    // Vérification finale avant envoi (évite 400 si le champ a été vidé entre-temps)
    const emailFinal = (document.getElementById('email') as HTMLInputElement | null)?.value?.trim() ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFinal)) {
      setSubmitError('Adresse e-mail invalide ou manquante.');
      document.getElementById('email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      // Toujours reprendre l'email depuis le DOM pour l'envoi (évite tout décalage)
      const emailForPayload =
        (document.getElementById('email') as HTMLInputElement | null)
          ?.value?.trim() ?? '';
      const payload = {
        ...formDataRef.current,
        email: emailForPayload,
      };

      // Collecte de tous les fichiers (Logo + Visuel) : refs + inputs DOM au moment de l'envoi
      const fromLogo = selectedFilesRef.current.length > 0
        ? selectedFilesRef.current
        : (fileInputRef.current?.files ? Array.from(fileInputRef.current.files) : []);
      const fromVisuel = selectedExemplaireFilesRef.current.length > 0
        ? selectedExemplaireFilesRef.current
        : (exemplaireFileInputRef.current?.files ? Array.from(exemplaireFileInputRef.current.files) : []);
      const allFileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
      const fromDom: File[] = [];
      allFileInputs.forEach((input) => {
        if (input.files && input.files.length > 0) {
          fromDom.push(...Array.from(input.files));
        }
      });
      const seen = new Set<string>();
      const files: File[] = [];
      [...fromLogo, ...fromVisuel, ...fromDom].forEach((file) => {
        const key = `${file.name}-${file.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          files.push(file);
        }
      });
      const hasFiles = files.length > 0;

      let res: Response;
      if (hasFiles) {
        const formData = new FormData();
        formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'data.json');
        files.forEach((file) => formData.append('files', file));
        res = await fetch(`${API_URL}/api/submit`, {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(`${API_URL}/api/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
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
      const isConnectionRefused =
        message.includes('Failed to fetch') ||
        message.includes('Connection refused') ||
        message.includes('ERR_CONNECTION_REFUSED') ||
        message.includes('NetworkError');
      setSubmitError(
        isConnectionRefused
          ? 'Serveur d’envoi injoignable. Lancez « npm run start » dans un terminal (pour démarrer le site + l’API), puis réessayez.'
          : message,
      );
      if (isConnectionRefused && typeof window !== 'undefined' && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
        setSubmitError("Erreur de connexion au serveur. Veuillez réessayer plus tard.");
      }
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
            <p className="hero-promo">Réduction de -20% sur toutes les prestations</p>
            <p className="hero-kicker">Formulaire</p>
            <h1 className="hero-title">
              Formulaire <span>Complet</span>
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

        <section className="form-card" aria-label="Formulaire de brief">
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

              <div className="form-field" id="form-field-email">
                <label className="field-label" htmlFor="email">
                  Adresse e-mail <span style={{ color: '#ff0671' }}>*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
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

              <div className="form-field">
                <label className="field-label" htmlFor="phone">
                  Numéro de téléphone
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="text-input"
                  placeholder="Ex: +33 6 12 34 56 78"
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
                  aria-selected={service === 'visuel'}
                  className={
                    service === 'visuel'
                      ? 'service-tab service-tab-active'
                      : 'service-tab'
                  }
                  onClick={() => setService('visuel')}
                >
                  Visuel
                </button>
              </div>
            </section>

            {service === 'logo' && (
              <section className="form-section">
                <p className="form-section-kicker">Section Logo</p>

                <div className="logo-stepper" role="progressbar" aria-valuenow={logoStep + 1} aria-valuemin={1} aria-valuemax={4} aria-label="Étapes du formulaire logo">
                  <div className="logo-stepper-track">
                    <div
                      className="logo-stepper-line-fill"
                      style={{ width: `${(logoStep / 3) * 100}%` }}
                      aria-hidden
                    />
                    {[
                      { id: 0, label: "À propos logo" },
                      { id: 1, label: "Naissance d'idée" },
                      { id: 2, label: "Client cible" },
                      { id: 3, label: "Exemplaire" },
                    ].map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        className={`logo-stepper-step ${logoStep >= step.id ? 'logo-stepper-step-active' : ''}`}
                        onClick={() => setLogoStep(step.id)}
                        aria-current={logoStep === step.id ? 'step' : undefined}
                      >
                        <span className="logo-stepper-dot" />
                        <span className="logo-stepper-label">{step.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {logoStep === 0 && (
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
                        <option value="" disabled>-- Sélectionnez --</option>
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
                        <option value="" disabled>-- Sélectionnez --</option>
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
                        <option value="" disabled>-- Sélectionnez --</option>
                        <option value="majuscules">En majuscules</option>
                        <option value="minuscules">En minuscules</option>
                        <option value="mixte">Majuscules &amp; minuscules</option>
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
                  </>
                )}

                {logoStep === 1 && (
                  <div className="logo-step-content">
                    <div className="form-field">
                      <label className="field-label" htmlFor="birth">
                        Comment est née votre entreprise ?
                      </label>
                      <textarea
                        id="birth"
                        className="textarea-input logo-step-textarea"
                        placeholder=""
                        rows={4}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label" htmlFor="anecdote">
                        Y a-t-il une anecdote ou un moment fondateur qui vous définit ?
                      </label>
                      <textarea
                        id="anecdote"
                        className="textarea-input logo-step-textarea"
                        placeholder=""
                        rows={4}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label" htmlFor="person">
                        Si votre marque était une personne, comment la décririez-vous ?
                      </label>
                      <textarea
                        id="person"
                        className="textarea-input logo-step-textarea"
                        placeholder=""
                        rows={4}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label" htmlFor="images">
                        Quels mots ou images viennent à l&apos;esprit quand vous pensez à votre marque idéale ?
                      </label>
                      <textarea
                        id="images"
                        className="textarea-input logo-step-textarea"
                        placeholder=""
                        rows={4}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label" htmlFor="summary">
                        Comment décririez-vous votre entreprise en quelques mots ?
                      </label>
                      <textarea
                        id="summary"
                        className="textarea-input logo-step-textarea"
                        placeholder=""
                        rows={4}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                )}

                {logoStep === 2 && (
                  <>
                    <div className="form-field">
                      <label className="field-label" htmlFor="idealClients">
                        Qui sont vos clients idéaux ?
                      </label>
                      <textarea
                        id="idealClients"
                        className="textarea-input logo-step-textarea"
                        placeholder="Décrivez votre cible idéale..."
                        rows={4}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label" htmlFor="problems">
                        Quels problèmes ou besoins votre entreprise résout-elle ?
                      </label>
                      <textarea
                        id="problems"
                        className="textarea-input logo-step-textarea"
                        placeholder=""
                        rows={4}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label" htmlFor="difference">
                        Qu&apos;est-ce qui vous distingue de la concurrence ?
                      </label>
                      <textarea
                        id="difference"
                        className="textarea-input logo-step-textarea"
                        placeholder=""
                        rows={4}
                        onChange={handleFormChange}
                      />
                    </div>
                  </>
                )}

                {logoStep === 3 && (
                  <div className="logo-step-exemplaire">
                    <h3 className="logo-step-exemplaire-title">
                      Importez des modèles de design que vous aimez
                    </h3>
                    <div
                      className="logo-step-upload-zone"
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        id="file"
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        className="file-input-hidden"
                        onChange={handleFormChange}
                      />
                      <span className="logo-step-upload-icon" aria-hidden>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                          <path d="M3 16l5-5 4 4 6-6 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </span>
                      <span className="logo-step-upload-text">
                        {referenceFileLabel || 'Importez des images'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="logo-stepper-actions">
                  {logoStep < 3 ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setLogoStep((s) => Math.min(3, s + 1))}
                    >
                      Suivant
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={submitting}
                      onClick={handleSubmit}
                    >
                      {submitting ? 'Envoi en cours…' : 'Envoyer le formulaire'}
                    </button>
                  )}
                </div>
              </section>
            )}

            {service === 'webapp' && (
              <section className="form-section">
                <p className="form-section-kicker">Section Application Web</p>

                <div className="form-field">
                  <label className="field-label" htmlFor="webType">
                    Type d&apos;application web
                  </label>
                  <select
                    id="webType"
                    className="select-input"
                    defaultValue=""
                    onChange={handleFormChange}
                  >
                    <option value="" disabled>
                      -- Sélectionnez --
                    </option>
                    <option value="vitrine">Site vitrine</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="saas">Application SaaS</option>
                    <option value="plateforme">Plateforme communautaire</option>
                    <option value="portfolio">Portfolio</option>
                    <option value="blog">Blog</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="webFeatures">
                    Fonctionnalités principales souhaitées
                  </label>
                  <textarea
                    id="webFeatures"
                    className="textarea-input"
                    rows={4}
                    placeholder="Ex: Authentification, paiement en ligne, chat en temps réel, tableau de bord..."
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="webStyle">
                    Style de design préféré
                  </label>
                  <select
                    id="webStyle"
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
                    <option value="sombre">Sombre</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="webTech">
                    Technologies ou frameworks préférés (optionnel)
                  </label>
                  <input
                    id="webTech"
                    type="text"
                    className="text-input"
                    placeholder="Ex: React, Vue, Next.js, WordPress..."
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="webNotes">
                    Informations complémentaires
                  </label>
                  <textarea
                    id="webNotes"
                    className="textarea-input"
                    rows={4}
                    placeholder="Décrivez vos besoins spécifiques, inspirations, ou toute autre information utile..."
                    onChange={handleFormChange}
                  />
                </div>
              </section>
            )}

            {service === 'visuel' && (
              <section className="form-section">
                <p className="form-section-kicker">Section Visuel</p>

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
                    <option value="affiche">Affiche</option>
                    <option value="couverture">Couverture</option>
                    <option value="reseau_social">Réseaux sociaux</option>
                    <option value="packaging">Packaging</option>
                    <option value="illustration">Illustration</option>
                    <option value="autre">Autre</option>
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
                    <option value="mode">Mode</option>
                    <option value="gastronomie">Gastronomie</option>
                    <option value="culture">Culture</option>
                    <option value="tech">Tech</option>
                    <option value="sante">Santé</option>
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
                    placeholder="Ex: Votre marque ou entreprise"
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
                    placeholder="Ex: Mise en avant produit, couverture réseaux sociaux..."
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="exemplaire">
                    Importez des modèles de design que vous aimez
                  </label>
                  <p className="field-hint">
                    Importez des images pour illustrer vos attentes
                  </p>
                  <div
                    className="file-input-wrapper"
                    role="button"
                    tabIndex={0}
                    onClick={() => exemplaireFileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        exemplaireFileInputRef.current?.click();
                      }
                    }}
                  >
                    <input
                      ref={exemplaireFileInputRef}
                      id="exemplaire"
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      className="file-input-hidden"
                      onChange={handleFormChange}
                    />
                    <span className="file-button">Importez des images ou PDF</span>
                    <span className="file-name">
                      {exemplaireFileLabel || 'Aucun fichier choisi'}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>

          {submitSuccess && (
            <p className="form-message form-message-success">
              Merci. Votre formulaire a bien été envoyé.
            </p>
          )}
          {submitError && (
            <p className="form-message form-message-error">{submitError}</p>
          )}
          {!(service === 'logo') && (
            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Envoi en cours…' : 'Envoyer le formulaire'}
            </button>
          )}
        </section>
      </div>
    </div>
  );
};

export default App;

