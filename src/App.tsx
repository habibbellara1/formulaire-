import React, { useState, useRef } from 'react';
import './style.css';

const partenaireImg =
  'https://www.figma.com/api/mcp/asset/ca123981-2c7f-4910-bf04-4ce572dd615b';

// URL de l'API d'envoi d'e-mail
// En développement : http://localhost:3001 (via `npm run server` ou `npm run start`)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Service = 'logo' | 'webapp' | 'mobile';

export const App: React.FC = () => {
  const [service, setService] = useState<Service>('logo');
  const formDataRef = useRef<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [referenceFileLabel, setReferenceFileLabel] = useState<string>('');
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
      const names = files.map((f) => f.name).join(', ');
      formDataRef.current[t.id] = names;
      if (t.id === 'file') {
        setReferenceFileLabel(files.length ? (files.length > 1 ? `${files.length} fichiers` : files[0].name) : '');
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
      const emailForPayload = (document.getElementById('email') as HTMLInputElement | null)?.value?.trim() ?? '';
      const payload = {
        ...formDataRef.current,
        email: emailForPayload,
      };

      const fileInput = fileInputRef.current;
      const files = fileInput?.files ? Array.from(fileInput.files) : [];
      const hasFiles = files.length > 0;

      const res = hasFiles
        ? await fetch(`${API_URL}/api/submit`, {
            method: 'POST',
            body: (() => {
              const formData = new FormData();
              formData.append('data', JSON.stringify(payload));
              files.forEach((f) => formData.append('files', f));
              return formData;
            })(),
          })
        : await fetch(`${API_URL}/api/submit`, {
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
        setSubmitError("Envoi impossible : déployez l'API (server/) sur Render ou Railway, puis définissez VITE_API_URL dans Netlify.");
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
                  aria-selected={service === 'mobile'}
                  className={
                    service === 'mobile'
                      ? 'service-tab service-tab-active'
                      : 'service-tab'
                  }
                  onClick={() => setService('mobile')}
                >
                  Application Mobile
                </button>
              </div>
            </section>

            {service === 'logo' && (
              <section className="form-section">
                <p className="form-section-kicker">Section Logo</p>

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

                <div className="form-field">
                  <label className="field-label" htmlFor="file">
                    Fichier de référence (optionnel)
                  </label>
                  <p className="field-hint">
                    Ajoutez une image ou un PDF pour illustrer vos attentes
                  </p>

                  <div
                    className="file-input-wrapper"
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
                      className="file-input-hidden"
                      onChange={handleFormChange}
                    />
                    <span className="file-button">Choisir un fichier</span>
                    <span className="file-name">
                      {referenceFileLabel || 'Aucun fichier choisi'}
                    </span>
                  </div>
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

            {service === 'mobile' && (
              <section className="form-section">
                <p className="form-section-kicker">Section Application Mobile</p>

                <div className="form-field">
                  <label className="field-label" htmlFor="mobileType">
                    Type d&apos;application mobile
                  </label>
                  <select
                    id="mobileType"
                    className="select-input"
                    defaultValue=""
                    onChange={handleFormChange}
                  >
                    <option value="" disabled>
                      -- Sélectionnez --
                    </option>
                    <option value="reseau_social">Réseau social</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="productivite">Productivité</option>
                    <option value="jeu">Jeu</option>
                    <option value="sante">Santé et fitness</option>
                    <option value="education">Éducation</option>
                    <option value="divertissement">Divertissement</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="form-field">
                  <span className="field-label">Plateformes cibles</span>
                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input
                        id="mobilePlatformIos"
                        type="checkbox"
                        onChange={handleFormChange}
                      />
                      <span>iOS (iPhone, iPad)</span>
                    </label>
                    <label className="checkbox-item">
                      <input
                        id="mobilePlatformAndroid"
                        type="checkbox"
                        onChange={handleFormChange}
                      />
                      <span>Android</span>
                    </label>
                    <label className="checkbox-item">
                      <input
                        id="mobilePlatformCross"
                        type="checkbox"
                        onChange={handleFormChange}
                      />
                      <span>Cross-platform (React Native, Flutter)</span>
                    </label>
                  </div>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="mobileFeatures">
                    Fonctionnalités principales souhaitées
                  </label>
                  <textarea
                    id="mobileFeatures"
                    className="textarea-input"
                    rows={4}
                    placeholder="Ex: Notifications push, géolocalisation, appareil photo, paiement intégré..."
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="mobileStyle">
                    Style de design préféré
                  </label>
                  <select
                    id="mobileStyle"
                    className="select-input"
                    defaultValue=""
                    onChange={handleFormChange}
                  >
                    <option value="" disabled>
                      -- Sélectionnez --
                    </option>
                    <option value="material">Material Design (Android)</option>
                    <option value="ios">iOS Human Interface</option>
                    <option value="personnalise">Personnalisé</option>
                    <option value="minimaliste">Minimaliste</option>
                    <option value="colore">Coloré et dynamique</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="mobileNotes">
                    Informations complémentaires
                  </label>
                  <textarea
                    id="mobileNotes"
                    className="textarea-input"
                    rows={4}
                    placeholder="Décrivez vos besoins spécifiques, inspirations, ou toute autre information utile..."
                    onChange={handleFormChange}
                  />
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
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Envoi en cours…' : 'Envoyer le formulaire'}
          </button>
        </section>
      </div>
    </div>
  );
};

export default App;

