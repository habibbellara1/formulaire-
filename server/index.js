import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '512kb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo par fichier
}).any(); // accepte 'data' (texte) + 'files' (fichiers) pour que req.body.data soit bien rempli

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(data) {
  const rows = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;width:40%;">${escapeHtml(k)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${escapeHtml(String(v))}</td>
        </tr>`
    )
    .join('');
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouveau formulaire</title>
</head>
<body style="margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:#f3f4f6;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
    <div style="background:linear-gradient(90deg,#ff0671,#9333ea);padding:24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:1.5rem;font-weight:700;">Nouveau formulaire</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:0.9rem;">Viviworks – Formulaire Complet</p>
    </div>
    <div style="padding:24px;">
      <table style="border-collapse:collapse;width:100%;">
        ${rows}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Cet email a été envoyé depuis le formulaire viviworks.ai</p>
    </div>
  </div>
</body>
</html>`;
}

app.post('/api/submit', (req, res, next) => {
  const isMultipart = (req.headers['content-type'] || '').includes('multipart/form-data');
  if (isMultipart) {
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: 'Erreur upload fichier.' });
      next();
    });
  } else {
    next();
  }
}, async (req, res) => {
  try {
    let body = req.body || {};
    const rawData = req.body && req.body.data;
    if (typeof rawData === 'string') {
      try {
        body = JSON.parse(rawData);
      } catch (e) {
        console.error('Parse body.data:', e);
        return res.status(400).json({ success: false, message: 'Format des données invalide.' });
      }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Données formulaire manquantes. Réessayez sans pièce jointe ou vérifiez votre connexion.' });
    }
    const email = (body.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Adresse e-mail invalide.' });
    }

    const labels = {
      email: 'Adresse e-mail',
      fullname: 'Nom et prénom',
      company: "Nom de l'entreprise / projet",
      file: 'Fichier de référence (étape 1)',
      sector: "Secteur d'activité",
      style: 'Style de logo préféré',
      wantedColors: 'Couleurs souhaitées',
      avoidColors: 'Couleurs à éviter',
      letters: 'Lettres du logo',
      message: 'Message ou feeling',
      birth: 'Comment est née votre entreprise',
      anecdote: 'Anecdote ou moment fondateur',
      person: 'Marque comme personne',
      images: 'Mots ou images (marque idéale)',
      summary: 'Entreprise en quelques mots',
      idealClients: 'Clients idéaux',
      problems: 'Problèmes ou besoins résolus',
      difference: 'Ce qui vous distingue',
      visualType: 'Type de visuel',
      visualSector: "Secteur d'activité (visuel)",
      visualBrand: "Nom entreprise / marque",
      visualGoal: "Objectif principal du visuel",
      exemplaireFileNames: 'Fichiers exemplaire (noms)',
      webType: "Type d'application web",
      webFeatures: 'Fonctionnalités principales souhaitées',
      webStyle: 'Style de design préféré (web)',
      webTech: 'Technologies ou frameworks préférés',
      webNotes: 'Informations complémentaires (web)',
      mobileType: "Type d'application mobile",
      mobilePlatformIos: 'Plateforme iOS',
      mobilePlatformAndroid: 'Plateforme Android',
      mobilePlatformCross: 'Plateforme Cross-platform',
      mobileFeatures: 'Fonctionnalités principales (mobile)',
      mobileStyle: 'Style de design préféré (mobile)',
      mobileNotes: 'Informations complémentaires (mobile)',
    };

    const dataForEmail = {};
    for (const [key, label] of Object.entries(labels)) {
      let v = body[key];
      if (v === 'true') v = 'Oui';
      if (v === 'false') continue;
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        dataForEmail[label] = Array.isArray(v) ? v.join(', ') : String(v);
      }
    }

    const files = req.files || [];
    if (files.length > 0) {
      dataForEmail['Fichiers joints'] = files.map((f) => f.originalname).join(', ');
    }

    const attachments = files.map((f) => ({
      filename: f.originalname,
      content: f.buffer,
    }));

    const toEmail = process.env.TO_EMAIL;
    if (!toEmail) {
      console.error('TO_EMAIL non configuré');
      return res.status(500).json({ success: false, message: 'Configuration serveur manquante.' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: toEmail,
      subject: `Formulaire Complet – ${email}`,
      html: buildEmailHtml(dataForEmail),
      text: Object.entries(dataForEmail).map(([k, v]) => `${k}: ${v}`).join('\n'),
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    res.json({ success: true, message: 'Merci. Votre formulaire a bien été envoyé.' });
  } catch (err) {
    console.error('Erreur envoi email:', err);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi. Réessayez plus tard.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur API écoute sur http://localhost:${PORT}`);
});
