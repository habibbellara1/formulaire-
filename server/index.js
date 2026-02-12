import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
// Tout le formulaire (y compris fichiers en base64) est envoyé en JSON
app.use(express.json({ limit: '50mb' }));

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

app.post('/api/submit', async (req, res) => {
  try {
    let body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Aucune donnée reçue.' });
    }

    const rawFiles = body._files;
    const filesFromBase64 = Array.isArray(rawFiles)
      ? rawFiles
      : rawFiles
          ? [rawFiles]
          : [];
    delete body._files;

    if (rawFiles !== undefined) {
      console.log('[submit] _files reçus:', filesFromBase64.length, filesFromBase64.length ? '(noms: ' + filesFromBase64.map((f) => f && f.name).join(', ') + ')' : '');
    }

    const attachments = [];
    const tempFiles = [];
    for (const f of filesFromBase64) {
      if (!f || typeof f.data !== 'string' || !f.name) continue;
      const base64Clean = String(f.data).replace(/\s/g, '');
      if (!base64Clean.length) continue;
      try {
        const buf = Buffer.from(base64Clean, 'base64');
        if (buf.length === 0) continue;
        const ext = path.extname(f.name) || '';
        const tmpPath = path.join(os.tmpdir(), `form-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        fs.writeFileSync(tmpPath, buf);
        tempFiles.push(tmpPath);
        attachments.push({
          filename: String(f.name),
          path: tmpPath,
        });
      } catch (err) {
        console.error('[submit] Erreur pièce jointe', f.name, err.message);
      }
    }

    try {
      if (attachments.length > 0) {
        console.log('[submit] Pièces jointes à envoyer:', attachments.length, attachments.map((a) => a.filename));
      }

    const email = (body.email || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res
          .status(400)
          .json({ success: false, message: 'Adresse e-mail invalide.' });
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
      };

      const dataForEmail = {};
      for (const [key, label] of Object.entries(labels)) {
        let v = body[key];
        if (v === 'true') v = 'Oui';
        if (v === 'false') continue;
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          dataForEmail[label] = Array.isArray(v)
            ? v.join(', ')
            : String(v);
        }
      }

      // Fichier de référence : afficher les noms des pièces jointes réelles (pas un champ texte)
      if (attachments.length > 0) {
        dataForEmail['Fichier de référence (étape 1)'] = attachments.map((a) => a.filename).join(', ');
      }

      const toEmail = process.env.TO_EMAIL;
      if (!toEmail) {
        console.error('TO_EMAIL non configuré');
        return res
          .status(500)
          .json({
            success: false,
            message: 'Configuration serveur manquante.',
          });
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
        text: Object.entries(dataForEmail)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n'),
        attachments:
          attachments.length > 0 ? attachments : undefined,
      });

      res.json({
        success: true,
        message: 'Merci. Votre formulaire a bien été envoyé.',
      });
    } finally {
      for (const p of tempFiles) {
        try { fs.unlinkSync(p); } catch (_) {}
      }
    }
  } catch (err) {
    console.error('Erreur envoi email:', err);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi. Réessayez plus tard.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur API écoute sur http://localhost:${PORT}`);
});
