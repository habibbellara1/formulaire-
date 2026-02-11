import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '512kb' }));

function getValue(el) {
  if (!el) return '';
  if (el.type === 'file') return el.files?.length ? Array.from(el.files).map(f => f.name).join(', ') : '';
  return (el.value || '').trim();
}

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
    .map(([k, v]) => `<tr><td style="padding:8px;border:1px solid #ddd;"><strong>${escapeHtml(k)}</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(String(v))}</td></tr>`)
    .join('');
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;">
  <h2>Nouveau questionnaire (Section Logo)</h2>
  <table style="border-collapse:collapse;width:100%;max-width:600px;">
    ${rows}
  </table>
</body>
</html>`;
}

app.post('/api/submit', async (req, res) => {
  try {
    const body = req.body || {};
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
    };

    const dataForEmail = {};
    for (const [key, label] of Object.entries(labels)) {
      const v = body[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        dataForEmail[label] = Array.isArray(v) ? v.join(', ') : String(v);
      }
    }

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
      subject: `Questionnaire Complet – ${email}`,
      html: buildEmailHtml(dataForEmail),
      text: Object.entries(dataForEmail).map(([k, v]) => `${k}: ${v}`).join('\n'),
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
