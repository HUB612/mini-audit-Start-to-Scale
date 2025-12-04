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
  const brevoListId = process.env.BREVO_LIST_ID;

  // Vérifier que les variables d'environnement sont définies
  if (!brevoApiKey) {
    console.error('BREVO_API_KEY is not set');
    return response.status(500).json({ error: 'Server configuration error' });
  }

  if (!brevoListId) {
    console.error('BREVO_LIST_ID is not set');
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

    // 1. Ajouter le contact à la liste Brevo
    const contactPayload = {
      email: formData.contact_email,
      attributes: {
        PRENOM: formData.contact_name.split(' ')[0] || formData.contact_name,
        NOM: formData.contact_name.split(' ').slice(1).join(' ') || '',
        STARTUP: formData.startup_name,
        TELEPHONE: formData.contact_phone || '',
        MESSAGE: formData.message || '',
      },
      listIds: [parseInt(brevoListId, 10)],
      updateEnabled: true, // Met à jour le contact s'il existe déjà
    };

    const addContactResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });

    // Ne pas échouer si le contact existe déjà (code 400 avec "duplicate_parameter")
    let contactAdded = false;
    if (!addContactResponse.ok) {
      const errorText = await addContactResponse.text();
      try {
        const errorData = JSON.parse(errorText);
        
        // Si c'est une erreur de duplication, on continue (le contact existe déjà)
        if (errorData.code === 'duplicate_parameter') {
          console.log('Contact already exists in list, continuing...');
          contactAdded = true; // Le contact existe déjà, c'est OK
        } else {
          console.error('Brevo API error adding contact:', errorText);
          // On continue quand même pour envoyer l'email de remerciement
        }
      } catch (parseError) {
        console.error('Error parsing Brevo API error response:', parseError);
        // On continue quand même pour envoyer l'email de remerciement
      }
    } else {
      contactAdded = true;
    }

    // 2. Envoyer un email de remerciement au contact
    const thankYouEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Merci pour votre intérêt !</h2>
        <p>Bonjour ${escapeHtml(formData.contact_name)},</p>
        <p>Nous avons bien reçu votre demande de contact concernant <strong>${escapeHtml(formData.startup_name)}</strong>.</p>
        <p>Nous vous remercions de votre intérêt pour notre programme <strong>Start to Scale</strong>.</p>
        <p>Notre équipe va examiner votre demande et reviendra vers vous rapidement pour un premier échange.</p>
        <p>En attendant, n'hésitez pas à consulter notre site pour en savoir plus sur nos services.</p>
        <p style="margin-top: 30px;">Cordialement,<br>L'équipe Hub612</p>
      </div>
    `;

    const thankYouEmailPayload = {
      sender: {
        name: brevoSenderName,
        email: brevoSenderEmail,
      },
      to: [
        {
          email: formData.contact_email,
          name: formData.contact_name,
        },
      ],
      subject: 'Merci pour votre demande - Hub612 Start to Scale',
      htmlContent: thankYouEmailContent,
    };

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(thankYouEmailPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Brevo API error sending thank you email:', errorText);
      return response.status(500).json({ 
        error: 'Failed to send thank you email',
        details: errorText 
      });
    }

    const emailResult = await emailResponse.json();

    // Répondre avec succès
    return response.status(200).json({ 
      success: true,
      messageId: emailResult.messageId,
      contactAdded: contactAdded,
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

