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

    // Extraire prénom et nom de manière plus intelligente
    const nameParts = formData.contact_name.trim().split(/\s+/);
    const firstName = nameParts[0] || formData.contact_name;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // 1. Créer ou récupérer l'entreprise dans Brevo
    let companyId: number | null = null;
    
    try {
      // Créer l'entreprise directement (Brevo gère les doublons)
      const createCompanyPayload = {
        name: formData.startup_name,
        attributes: {},
      };

      const createCompanyResponse = await fetch('https://api.brevo.com/v3/companies', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(createCompanyPayload),
      });

      if (createCompanyResponse.ok) {
        const newCompany = await createCompanyResponse.json();
        companyId = newCompany.id;
        console.log(`Company created/found: ${formData.startup_name} (ID: ${companyId})`);
      } else {
        // Si l'entreprise existe déjà, essayer de la récupérer par recherche
        const errorText = await createCompanyResponse.text();
        console.log('Company may already exist, attempting search...');
        
        // Recherche simplifiée par nom
        const searchResponse = await fetch(
          `https://api.brevo.com/v3/companies?limit=50`,
          {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'api-key': brevoApiKey,
            },
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const foundCompany = searchData.companies?.find(
            (c: any) => c.name?.toLowerCase() === formData.startup_name.toLowerCase()
          );
          if (foundCompany) {
            companyId = foundCompany.id;
            console.log(`Company found: ${formData.startup_name} (ID: ${companyId})`);
          }
        }
      }
    } catch (companyError) {
      console.error('Error processing company:', companyError);
      // On continue même si la gestion de l'entreprise échoue
    }

    // Nettoyer le numéro de téléphone
    const cleanedPhone = cleanPhoneNumber(formData.contact_phone);

    // 2. Ajouter le contact à la liste Brevo avec toutes les informations
    const contactAttributes: any = {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
      PRENOM: firstName, // Attribut personnalisé si utilisé
      NOM: lastName, // Attribut personnalisé si utilisé
      STARTUP: formData.startup_name,
      COMPANY: formData.startup_name, // Attribut company standard
      MESSAGE: formData.message || '',
    };

    // Ajouter le téléphone uniquement s'il est valide
    if (cleanedPhone) {
      contactAttributes.SMS = cleanedPhone;
      contactAttributes.TELEPHONE = cleanedPhone;
    }

    const contactPayload: any = {
      email: formData.contact_email,
      attributes: contactAttributes,
      listIds: [parseInt(brevoListId, 10)],
      updateEnabled: true, // Met à jour le contact s'il existe déjà
    };

    // Ajouter l'entreprise si elle a été créée/trouvée
    if (companyId) {
      contactPayload.companyId = companyId;
    }

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
    let contactId: number | null = null;

    if (!addContactResponse.ok) {
      const errorText = await addContactResponse.text();
      try {
        const errorData = JSON.parse(errorText);
        
        // Si c'est une erreur de duplication, on continue (le contact existe déjà)
        if (errorData.code === 'duplicate_parameter') {
          console.log('Contact already exists, updating...');
          contactAdded = true;
          
          // Essayer de récupérer l'ID du contact existant pour l'associer à l'entreprise
          try {
            const getContactResponse = await fetch(
              `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
              {
                method: 'GET',
                headers: {
                  'accept': 'application/json',
                  'api-key': brevoApiKey,
                },
              }
            );
            
            if (getContactResponse.ok) {
              const contactData = await getContactResponse.json();
              contactId = contactData.id;
            }
          } catch (getError) {
            console.error('Error getting contact ID:', getError);
          }
        } else {
          console.error('Brevo API error adding contact:', errorText);
          // On continue quand même pour envoyer l'email de remerciement
        }
      } catch (parseError) {
        console.error('Error parsing Brevo API error response:', parseError);
        // On continue quand même pour envoyer l'email de remerciement
      }
    } else {
      const contactResult = await addContactResponse.json();
      contactAdded = true;
      contactId = contactResult.id;
    }

    // 3. Associer le contact à l'entreprise si nécessaire
    if (companyId) {
      try {
        // Si on n'a pas encore l'ID du contact, le récupérer
        if (!contactId) {
          try {
            const getContactResponse = await fetch(
              `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
              {
                method: 'GET',
                headers: {
                  'accept': 'application/json',
                  'api-key': brevoApiKey,
                },
              }
            );
            
            if (getContactResponse.ok) {
              const contactData = await getContactResponse.json();
              contactId = contactData.id;
            }
          } catch (getError) {
            console.error('Error getting contact ID for company link:', getError);
          }
        }

        // Associer le contact à l'entreprise si on a l'ID
        if (contactId) {
          const linkContactResponse = await fetch(
            `https://api.brevo.com/v3/companies/${companyId}/contacts`,
            {
              method: 'POST',
              headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                linkContactIds: [contactId],
              }),
            }
          );

          if (!linkContactResponse.ok) {
            const errorText = await linkContactResponse.text();
            // Ne pas échouer si le contact est déjà associé
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.code !== 'duplicate_parameter') {
                console.error('Error linking contact to company:', errorText);
              } else {
                console.log('Contact already linked to company');
              }
            } catch {
              console.error('Error linking contact to company:', errorText);
            }
          } else {
            console.log(`Contact ${contactId} linked to company ${companyId}`);
          }
        }
      } catch (linkError) {
        console.error('Error linking contact to company:', linkError);
        // On continue même si l'association échoue
      }
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

// Fonction utilitaire pour nettoyer et valider le numéro de téléphone
function cleanPhoneNumber(phone: string | undefined): string | null {
  if (!phone) {
    return null;
  }
  
  // Nettoyer le numéro : garder uniquement les chiffres, +, espaces et tirets
  const cleaned = phone.trim().replace(/[^\d+\s-]/g, '');
  
  // Si le numéro est vide après nettoyage, retourner null
  if (!cleaned || cleaned.length < 3) {
    return null;
  }
  
  return cleaned;
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

