import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ContactFormData {
  startup_name: string;
  contact_firstname: string;
  contact_lastname: string;
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
    if (!formData.startup_name || !formData.contact_firstname || !formData.contact_lastname || !formData.contact_email) {
      return response.status(400).json({ 
        error: 'Missing required fields: startup_name, contact_firstname, contact_lastname, contact_email' 
      });
    }

    // Utiliser directement les champs séparés
    const firstName = formData.contact_firstname.trim();
    const lastName = formData.contact_lastname.trim();

    console.log(`Contact: FirstName: "${firstName}", LastName: "${lastName}"`);

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
        console.log(`Company created: ${formData.startup_name} (ID: ${companyId}, type: ${typeof companyId})`);
        console.log(`Company full data:`, JSON.stringify(newCompany, null, 2));
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
    // Note: Brevo utilise FIRSTNAME et LASTNAME comme attributs standards
    const contactAttributes: any = {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
      STARTUP: formData.startup_name,
      COMPANY: formData.startup_name, // Attribut company standard
      MESSAGE: formData.message || '',
    };
    
    console.log(`Contact attributes:`, JSON.stringify(contactAttributes, null, 2));

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

    // Note: L'API Brevo ne permet pas d'associer directement un contact à une entreprise
    // lors de la création. Il faut faire la liaison via l'endpoint /companies/{id}/contacts
    // après la création du contact.

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
              
              // Mettre à jour le contact existant avec les attributs
              // Note: On ne peut pas mettre à jour le companyId via PUT /contacts
              // Il faut utiliser l'endpoint /companies/{id}/contacts pour la liaison
              if (Object.keys(contactAttributes).length > 0) {
                const updatePayload: any = {
                  attributes: contactAttributes,
                };
                
                const updateContactResponse = await fetch(
                  `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
                  {
                    method: 'PUT',
                    headers: {
                      'accept': 'application/json',
                      'api-key': brevoApiKey,
                      'content-type': 'application/json',
                    },
                    body: JSON.stringify(updatePayload),
                  }
                );
                
                if (updateContactResponse.ok) {
                  console.log(`Contact ${contactId} updated with attributes`);
                } else {
                  const updateErrorText = await updateContactResponse.text();
                  console.error('Error updating contact:', updateErrorText);
                }
              }
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
      console.log(`✓ New contact created: ${formData.contact_email} (ID: ${contactId})`);
    }

    // S'assurer qu'on a toujours le contactId (récupérer via GET si nécessaire)
    if (!contactId && contactAdded) {
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
          console.log(`✓ Contact ID retrieved: ${contactId}`);
        }
      } catch (getError) {
        console.error('Error retrieving contact ID:', getError);
      }
    }

    // 3. Associer le contact à l'entreprise (obligatoire car l'API Brevo ne permet pas
    // d'associer directement un contact à une entreprise lors de la création)
    console.log(`Attempting to link contact ${contactId} to company ${companyId}`);
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
          // Méthode principale : mettre à jour le contact avec companyId via PUT
          // L'API Brevo permet d'associer un contact à une entreprise en mettant à jour le contact
          console.log(`Attempting to link contact to company via PUT update...`);
          console.log(`  Contact email: ${formData.contact_email}`);
          console.log(`  Company ID: ${companyId}`);
          
          // Essayer avec companyId à la racine
          const updatePayload = {
            companyId: companyId,
          };
          
          console.log(`Update payload (method 1):`, JSON.stringify(updatePayload));
          
          let updateContactResponse = await fetch(
            `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
            {
              method: 'PUT',
              headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );

          let responseStatus = updateContactResponse.status;
          let responseText = await updateContactResponse.text();
          
          console.log(`Update response status: ${responseStatus}`);
          console.log(`Update response body: ${responseText}`);

          // Vérifier si le contact a bien été mis à jour en le récupérant
          if (updateContactResponse.ok) {
            console.log(`✓ PUT request successful (status ${responseStatus}), verifying contact update...`);
            
            // Attendre un peu pour que la mise à jour soit propagée
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Récupérer le contact pour vérifier s'il a le companyId
            try {
              const verifyContactResponse = await fetch(
                `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
                {
                  method: 'GET',
                  headers: {
                    'accept': 'application/json',
                    'api-key': brevoApiKey,
                  },
                }
              );
              
              if (verifyContactResponse.ok) {
                const contactData = await verifyContactResponse.json();
                console.log(`Contact data after update:`, JSON.stringify(contactData, null, 2));
                
                if (contactData.companyId === companyId || contactData.companyId === String(companyId)) {
                  console.log(`✓✓✓ VERIFIED: Contact is linked to company ${companyId}`);
                } else {
                  console.warn(`⚠ WARNING: Contact companyId is ${contactData.companyId}, expected ${companyId}`);
                  console.warn(`  Trying alternative method with companyId in attributes...`);
                  
                  // Essayer avec companyId dans attributes
                  const updatePayload2 = {
                    attributes: {
                      COMPANY_ID: String(companyId),
                    },
                  };
                  
                  const updateContactResponse2 = await fetch(
                    `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
                    {
                      method: 'PUT',
                      headers: {
                        'accept': 'application/json',
                        'api-key': brevoApiKey,
                        'content-type': 'application/json',
                      },
                      body: JSON.stringify(updatePayload2),
                    }
                  );
                  
                  if (updateContactResponse2.ok) {
                    console.log(`✓ Alternative method (attributes) returned ${updateContactResponse2.status}`);
                  }
                }
              }
            } catch (verifyError) {
              console.error(`Error verifying contact update:`, verifyError);
            }
          } else {
            try {
              const errorData = JSON.parse(responseText);
              console.error(`✗✗✗ FAILED to link contact to company:`);
              console.error(`  Status: ${responseStatus}`);
              console.error(`  Error code: ${errorData.code}`);
              console.error(`  Error message: ${errorData.message}`);
              console.error(`  Full error: ${responseText}`);
              
              // Tentative alternative : utiliser l'endpoint /companies/{id}/contacts (si disponible)
              if (responseStatus === 400 || responseStatus === 422) {
                console.log(`Attempting alternative: POST to /companies/{id}/contacts...`);
                try {
                  const contactIdNum = typeof contactId === 'number' ? contactId : parseInt(String(contactId), 10);
                  if (!isNaN(contactIdNum)) {
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
                          linkContactIds: [contactIdNum],
                        }),
                      }
                    );
                    
                    if (linkContactResponse.ok) {
                      console.log(`✓✓✓ Alternative method SUCCESS: Contact linked via /companies/{id}/contacts`);
                    } else {
                      const altErrorText = await linkContactResponse.text();
                      console.error(`✗ Alternative method also failed: ${altErrorText}`);
                    }
                  }
                } catch (altError) {
                  console.error(`✗ Alternative method error:`, altError);
                }
              }
            } catch (parseError) {
              console.error(`✗✗✗ FAILED to link contact to company (non-JSON response):`);
              console.error(`  Status: ${responseStatus}`);
              console.error(`  Response: ${responseText}`);
            }
          }
        } else {
          const errorText = await verifyCompanyResponse.text();
          console.warn(`✗ Company ${companyId} not found: ${errorText}`);
        }
      } catch (linkError) {
        console.error('✗ Error linking contact to company:', linkError);
      }
    } else if (companyId && !contactId) {
      console.warn(`✗ Cannot link contact to company: companyId=${companyId} but contactId is null`);
    } else if (!companyId && contactId) {
      console.log(`ℹ No company to link: contactId=${contactId} but no companyId available`);
    }

    // 2. Envoyer un email de remerciement au contact
    const contactFullName = `${firstName} ${lastName}`.trim();
    const thankYouEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Merci pour votre intérêt !</h2>
        <p>Bonjour ${escapeHtml(contactFullName)},</p>
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
          name: contactFullName,
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

