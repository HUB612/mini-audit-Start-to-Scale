import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ContactFormData {
  startup_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  message?: string;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Vérifier que la méthode est POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Récupérer les variables d'environnement
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@hub612.com';
  const brevoSenderName = process.env.BREVO_SENDER_NAME || 'Hub612';
  const brevoRecipientEmail = process.env.BREVO_RECIPIENT_EMAIL;

  // Vérifier que les variables d'environnement sont définies
  if (!brevoApiKey) {
    console.error('BREVO_API_KEY is not set');
    return response.status(500).json({ error: 'Server configuration error' });
  }

  if (!brevoRecipientEmail) {
    console.error('BREVO_RECIPIENT_EMAIL is not set');
    return response.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Récupérer les données du formulaire
    const formData: ContactFormData = request.body;

    // Valider les champs requis
    if (!formData.startup_name || !formData.contact_name || !formData.contact_email) {
      return response.status(400).json({ 
        error: 'Missing required fields: startup_name, contact_name, contact_email' 
      });
    }

    // Construire le contenu de l'email
    const emailContent = `
      <h2>Nouvelle demande de contact - Start to Scale</h2>
      <p><strong>Nom de la startup:</strong> ${escapeHtml(formData.startup_name)}</p>
      <p><strong>Nom du contact:</strong> ${escapeHtml(formData.contact_name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(formData.contact_email)}</p>
      ${formData.contact_phone ? `<p><strong>Téléphone:</strong> ${escapeHtml(formData.contact_phone)}</p>` : ''}
      ${formData.message ? `<p><strong>Message:</strong></p><p>${escapeHtml(formData.message)}</p>` : ''}
    `;

    // Préparer la requête pour Brevo
    const brevoPayload = {
      sender: {
        name: brevoSenderName,
        email: brevoSenderEmail,
      },
      to: [
        {
          email: brevoRecipientEmail,
        },
      ],
      subject: `Nouvelle demande de contact - ${formData.startup_name}`,
      htmlContent: emailContent,
      replyTo: {
        email: formData.contact_email,
        name: formData.contact_name,
      },
    };

    // Envoyer l'email via l'API Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Brevo API error:', errorText);
      return response.status(500).json({ 
        error: 'Failed to send email',
        details: errorText 
      });
    }

    const brevoResult = await brevoResponse.json();

    // Répondre avec succès
    return response.status(200).json({ 
      success: true,
      messageId: brevoResult.messageId 
    });

  } catch (error) {
    console.error('Error processing contact form:', error);
    return response.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

