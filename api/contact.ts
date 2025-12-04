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
        console.log(`Company created: ${formData.startup_name} (ID: ${companyId})`);
      } else {
        // Si l'entreprise existe déjà, essayer de la récupérer par recherche
        const errorText = await createCompanyResponse.text();
        let errorData: any = null;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Ignorer l'erreur de parsing
        }
        
        console.log('Company creation failed, attempting search...', errorText);
        
        // Recherche par nom avec pagination (API Brevo v3)
        // On cherche dans les premières pages pour trouver l'entreprise
        let found = false;
        let offset = 0;
        const limit = 50;
        
        while (!found && offset < 200) { // Limiter à 4 pages max pour éviter les boucles infinies
          const searchResponse = await fetch(
            `https://api.brevo.com/v3/companies?limit=${limit}&offset=${offset}`,
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
              found = true;
              break;
            }
            
            // Si on a moins de résultats que la limite, on a atteint la fin
            if (!searchData.companies || searchData.companies.length < limit) {
              break;
            }
            
            offset += limit;
          } else {
            const searchErrorText = await searchResponse.text();
            console.error('Error searching for company:', searchErrorText);
            break;
          }
        }
        
        if (!found) {
          console.log(`Company not found: ${formData.startup_name} - will continue without company association`);
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

    // 3. Vérifier et associer le contact à l'entreprise si nécessaire
    // Note: Le companyId est déjà inclus dans le payload du contact, donc l'association
    // devrait être automatique. On fait une vérification supplémentaire seulement si nécessaire.
    if (companyId && contactId) {
      try {
        // Vérifier que l'entreprise existe avant de tenter la liaison
        const verifyCompanyResponse = await fetch(
          `https://api.brevo.com/v3/companies/${companyId}`,
          {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'api-key': brevoApiKey,
            },
          }
        );

        if (verifyCompanyResponse.ok) {
          // L'entreprise existe, on peut essayer de lier le contact si ce n'est pas déjà fait
          // (le companyId dans le payload devrait déjà avoir fait la liaison, mais on vérifie)
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
            // Ne pas échouer si le contact est déjà associé ou si l'association a déjà été faite
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.code === 'duplicate_parameter' || errorData.code === 'invalid_parameter') {
                console.log('Contact already linked to company or association handled automatically');
              } else {
                console.error('Error linking contact to company:', errorText);
              }
            } catch {
              // Si l'erreur n'est pas un JSON valide, c'est peut-être juste que l'association existe déjà
              console.log('Note: Company association may already exist (companyId was included in contact payload)');
            }
          } else {
            console.log(`Contact ${contactId} linked to company ${companyId}`);
          }
        } else {
          console.warn(`Company ${companyId} not found, skipping explicit link (may have been created automatically)`);
        }
      } catch (linkError) {
        console.error('Error linking contact to company:', linkError);
        // On continue même si l'association échoue car le companyId dans le payload devrait suffire
      }
    } else if (companyId && !contactId) {
      console.log('Company ID available but contact ID not retrieved, association handled via contact payload');
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
// Brevo exige le format international : + suivi de l'indicatif pays et du numéro, sans séparateurs
// Exemple : +33123456789 (pour un numéro français)
function cleanPhoneNumber(phone: string | undefined): string | null {
  if (!phone) {
    return null;
  }
  
  // Extraire uniquement les chiffres et le signe +
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  
  // Si le numéro est vide après nettoyage, retourner null
  if (!cleaned || cleaned.length < 4) {
    return null;
  }
  
  // Si le numéro commence déjà par +, le retourner tel quel
  if (cleaned.startsWith('+')) {
    // Valider qu'il y a au moins l'indicatif pays (minimum 2 chiffres après le +)
    if (cleaned.length < 4) {
      return null;
    }
    return cleaned;
  }
  
  // Si le numéro commence par 00 (format international alternatif), remplacer par +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }
  
  // Si le numéro commence par 0 (format français), remplacer par +33
  if (cleaned.startsWith('0')) {
    return '+33' + cleaned.substring(1);
  }
  
  // Sinon, ajouter + devant (supposant que c'est déjà un numéro international sans le +)
  return '+' + cleaned;
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

