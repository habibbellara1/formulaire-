import Busboy from 'busboy';
import { Readable } from 'stream';
import nodemailer from 'nodemailer';

/* ───── CORS headers ───── */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok(body) {
  return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function fail(code, msg) {
  return { statusCode: code, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: msg }) };
}

/* ───── Multipart parser (busboy) ───── */
function parseMultipart(headers, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    const bb = Busboy({ headers });

    bb.on('field', (name, value) => { fields[name] = value; });

    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        files.push({
          fieldname: name,
          buffer: Buffer.concat(chunks),
          filename: info.filename,
          mimetype: info.mimeType,
        });
      });
    });

    bb.on('finish', () => resolve({ fields, files }));
    bb.on('error', reject);

    Readable.from(bodyBuffer).pipe(bb);
  });
}

/* ───── HTML email builder (same as server/index.js) ───── */
function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Nouveau formulaire</title></head>
<body style="margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:#f3f4f6;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);overflow:hidden;">
    <div style="background:linear-gradient(90deg,#ff0671,#9333ea);padding:24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:1.5rem;font-weight:700;">Nouveau formulaire</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:0.9rem;">Viviworks – Formulaire Complet</p>
    </div>
    <div style="padding:24px;">
      <table style="border-collapse:collapse;width:100%;">${rows}</table>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Cet email a été envoyé depuis le formulaire viviworks.ai</p>
    </div>
  </div>
</body></html>`;
}

/* ───── Field labels (same as server/index.js) ───── */
const labels = {
  email: 'Adresse e-mail',
  fullname: 'Nom et prénom',
  company: "Nom de l'entreprise / projet",
  phone: 'Numéro de téléphone',
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
  visualBrand: 'Nom entreprise / marque',
  visualGoal: 'Objectif principal du visuel',
  webType: "Type d'application web",
  webFeatures: 'Fonctionnalités principales souhaitées',
  webStyle: 'Style de design préféré (web)',
  webTech: 'Technologies ou frameworks préférés',
  webNotes: 'Informations complémentaires (web)',
};

/* ───── Main handler ───── */
export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }
  if (event.httpMethod !== 'POST') {
    return fail(405, 'Method not allowed');
  }

  try {
    const ct = (event.headers['content-type'] || '');
    const isMultipart = ct.includes('multipart/form-data');
    let body;
    const attachments = [];

    if (isMultipart) {
      /* ── Parse multipart ── */
      const bodyBuffer = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body, 'utf-8');

      const { fields, files } = await parseMultipart({ 'content-type': ct }, bodyBuffer);

      // JSON payload is sent as a Blob file (fieldname=data) or as a text field
      const dataFile = files.find((f) => f.fieldname === 'data');
      let dataRaw = null;
      if (dataFile && dataFile.buffer) {
        dataRaw = dataFile.buffer.toString('utf8');
      } else if (fields.data) {
        dataRaw = fields.data;
      }
      if (!dataRaw) {
        return fail(400, 'Données manquantes.');
      }
      body = JSON.parse(dataRaw);

      // Collect actual file attachments (fieldname=files)
      for (const f of files) {
        if (f.fieldname !== 'files') continue;
        if (f.buffer && f.buffer.length > 0) {
          attachments.push({
            filename: f.filename || 'fichier',
            content: f.buffer,
            contentType: f.mimetype || undefined,
          });
        }
      }
    } else {
      /* ── Plain JSON ── */
      body = JSON.parse(event.body);
    }

    if (!body || typeof body !== 'object') {
      return fail(400, 'Aucune donnée reçue.');
    }

    const email = (body.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, 'Adresse e-mail invalide.');
    }

    /* ── Build email data ── */
    const dataForEmail = {};
    for (const [key, label] of Object.entries(labels)) {
      let v = body[key];
      if (v === 'true') v = 'Oui';
      if (v === 'false') continue;
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        dataForEmail[label] = Array.isArray(v) ? v.join(', ') : String(v);
      }
    }
    if (attachments.length > 0) {
      dataForEmail['Pièces jointes'] = attachments.map((a) => a.filename).join(', ');
    }

    /* ── Send email ── */
    const toEmail = process.env.TO_EMAIL;
    if (!toEmail) {
      return fail(500, 'Configuration serveur manquante (TO_EMAIL).');
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

    return ok({ success: true, message: 'Merci. Votre formulaire a bien été envoyé.', attachmentsCount: attachments.length });

  } catch (err) {
    console.error('[submit] Erreur:', err);
    return fail(500, "Erreur lors de l'envoi. Réessayez plus tard.");
  }
}
