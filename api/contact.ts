import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ContactFormData {
  startup_name: string;
  contact_firstname: string;
  contact_lastname: string;
  contact_email: string;
  contact_phone?: string;
  message?: string;
}

interface BrevoLinkCompanyPayload {
  linkContactIds?: number[];
  unlinkContactIds?: number[];
  linkDealIds?: string[];
  unlinkDealIds?: string[];
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Récupérer les variables d'environnement
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@hub612.com';
  const brevoSenderName = process.env.BREVO_SENDER_NAME || 'Hub612';
  const brevoListId = process.env.BREVO_LIST_ID;

  if (!brevoApiKey || !brevoListId) {
    console.error('✗ Missing required environment variables');
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

    const firstName = formData.contact_firstname.trim();
    const lastName = formData.contact_lastname.trim();
    const startupName = formData.startup_name.trim();

    // Nettoyer le numéro de téléphone
    const cleanedPhone = cleanPhoneNumber(formData.contact_phone);

    // Préparer les attributs du contact
    const contactAttributes: any = {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
      STARTUP: startupName,
      MESSAGE: formData.message || '',
    };
    
    if (cleanedPhone) {
      contactAttributes.SMS = cleanedPhone;
      contactAttributes.TELEPHONE = cleanedPhone;
    }

    const contactPayload: any = {
      email: formData.contact_email,
      attributes: contactAttributes,
      listIds: [parseInt(brevoListId, 10)],
      updateEnabled: true,
    };

    let contactId: number | null = null;
    let contactAdded = false;

    const addContactResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });

    const contactResponseStatus = addContactResponse.status;
    const contactResponseText = await addContactResponse.text();

    if (!addContactResponse.ok) {
      try {
        const errorData = JSON.parse(contactResponseText);
        
        // Détecter les erreurs critiques qui empêchent la création du contact
        if (errorData.code === 'invalid_parameter') {
          let errorMessage = 'Erreur de validation des données';
          
          // Personnaliser le message selon le type d'erreur
          if (errorData.message?.toLowerCase().includes('phone')) {
            errorMessage = 'Le numéro de téléphone est invalide. Veuillez utiliser un format valide (ex: +33 6 12 34 56 78 ou 06 12 34 56 78)';
          } else if (errorData.message?.toLowerCase().includes('email')) {
            errorMessage = 'L\'adresse email est invalide. Veuillez vérifier le format de votre email';
          }
          
          return response.status(400).json({ 
            error: errorMessage,
            details: errorData.message || 'Paramètre invalide'
          });
        }
        
        if (errorData.code === 'duplicate_parameter') {
          contactAdded = true;
          
          // Vérifier si c'est le SMS qui cause le conflit
          const isSmsConflict = errorData.metadata?.duplicate_identifiers?.includes('SMS');
          const isEmailConflict = errorData.metadata?.duplicate_identifiers?.includes('email');
          
          // Essayer d'abord de récupérer par email
          let getContactResponse = await fetch(
            `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
            {
              method: 'GET',
              headers: {
                accept: 'application/json',
                'api-key': brevoApiKey,
              },
            }
          );
          
          if (getContactResponse.ok) {
            const contactData: any = await getContactResponse.json();
            contactId = contactData.id;
            
            // Préparer les attributs à mettre à jour
            // Si le SMS cause un conflit, ne pas l'inclure dans la mise à jour
            const updateAttributes = { ...contactAttributes };
            if (isSmsConflict && !isEmailConflict) {
              delete updateAttributes.SMS;
              delete updateAttributes.TELEPHONE;
            }
            
            // Mettre à jour les attributs
            const updatePayload = { attributes: updateAttributes };
            await fetch(
              `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
              {
                method: 'PUT',
                headers: {
                  accept: 'application/json',
                  'api-key': brevoApiKey,
                  'content-type': 'application/json',
                },
                body: JSON.stringify(updatePayload),
              }
            );
          } else {
            // Si la récupération par email a échoué
            if (isSmsConflict && !isEmailConflict) {
              // Le SMS est déjà associé à un autre contact, créer sans SMS
              const contactPayloadWithoutSms: any = {
                email: formData.contact_email,
                attributes: {
                  FIRSTNAME: firstName,
                  LASTNAME: lastName,
                  STARTUP: startupName,
                  MESSAGE: formData.message || '',
                },
                listIds: [parseInt(brevoListId, 10)],
                updateEnabled: true,
              };
              
              const retryResponse = await fetch('https://api.brevo.com/v3/contacts', {
                method: 'POST',
                headers: {
                  accept: 'application/json',
                  'api-key': brevoApiKey,
                  'content-type': 'application/json',
                },
                body: JSON.stringify(contactPayloadWithoutSms),
              });
              
              const retryText = await retryResponse.text();
              
              if (retryResponse.ok) {
                const retryResult: any = JSON.parse(retryText);
                contactId = retryResult.id;
              } else {
                // Si ça échoue encore, analyser l'erreur
                try {
                  const retryErrorData = JSON.parse(retryText);
                  
                  // Si c'est encore un duplicate_parameter pour l'email, le contact existe déjà
                  if (retryErrorData.code === 'duplicate_parameter' && 
                      retryErrorData.metadata?.duplicate_identifiers?.includes('email')) {
                    const finalGetResponse = await fetch(
                      `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
                      {
                        method: 'GET',
                        headers: {
                          accept: 'application/json',
                          'api-key': brevoApiKey,
                        },
                      }
                    );
                    
                    if (finalGetResponse.ok) {
                      const finalContactData: any = await finalGetResponse.json();
                      contactId = finalContactData.id;
                      
                      // Mettre à jour les attributs sans SMS
                      const updateAttributes = {
                        FIRSTNAME: firstName,
                        LASTNAME: lastName,
                        STARTUP: startupName,
                        MESSAGE: formData.message || '',
                      };
                      
                      const updatePayload = { attributes: updateAttributes };
                      await fetch(
                        `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
                        {
                          method: 'PUT',
                          headers: {
                            accept: 'application/json',
                            'api-key': brevoApiKey,
                            'content-type': 'application/json',
                          },
                          body: JSON.stringify(updatePayload),
                        }
                      );
                    }
                  }
                } catch (parseRetryError) {
                  // Ignorer les erreurs de parsing
                }
              }
            }
          }
        } else {
          // Autre erreur non gérée
          // Si c'est une erreur critique (400, 422, etc.), renvoyer une erreur
          if (contactResponseStatus >= 400 && contactResponseStatus < 500) {
            let errorDetails = contactResponseText;
            try {
              const parsedError = JSON.parse(contactResponseText);
              errorDetails = parsedError.message || contactResponseText;
            } catch (_) {
              // Garder le texte brut si on ne peut pas le parser
            }
            return response.status(400).json({ 
              error: 'Erreur lors de l\'enregistrement du contact',
              details: errorDetails
            });
          }
        }
      } catch (parseError) {
        // Si on ne peut pas parser l'erreur mais que le statut est une erreur client, renvoyer quand même une erreur
        if (contactResponseStatus >= 400 && contactResponseStatus < 500) {
          return response.status(400).json({ 
            error: 'Erreur lors de l\'enregistrement du contact',
            details: 'Impossible de traiter votre demande. Veuillez vérifier vos informations.'
          });
        }
      }
    } else {
      try {
        const contactResult: any = JSON.parse(contactResponseText);
        contactAdded = true;
        contactId = contactResult.id;
      } catch (parseError) {
        // Ignorer les erreurs de parsing
      }
    }

    // Récupérer contactId si nécessaire
    if (!contactId && contactAdded) {
      try {
        const getContactResponse = await fetch(
          `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'api-key': brevoApiKey,
            },
          }
        );
        
        if (getContactResponse.ok) {
          const contactData: any = await getContactResponse.json();
          contactId = contactData.id;
        }
      } catch (getError) {
        // Ignorer les erreurs
      }
    }

    if (!contactId) {
      // Si la création du contact a vraiment échoué (pas juste un duplicate), renvoyer une erreur
      if (!contactAdded) {
        return response.status(400).json({ 
          error: 'Échec de l\'enregistrement du contact',
          details: 'Impossible d\'enregistrer votre contact. Veuillez vérifier vos informations et réessayer.'
        });
      }
    }

    let companyId: string | null = null;
    
    if (contactId) {
      const createCompanyPayload = {
        name: startupName,
        attributes: {},
      };

      const createCompanyResponse = await fetch('https://api.brevo.com/v3/companies', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(createCompanyPayload),
      });

      const companyResponseText = await createCompanyResponse.text();

      if (createCompanyResponse.ok) {
        try {
          const newCompany: any = JSON.parse(companyResponseText);
          companyId = newCompany.id;
        } catch (parseError) {
          // Ignorer les erreurs de parsing
        }
      } else {
        // Rechercher l'entreprise existante
        let found = false;
        let offset = 0;
        const limit = 50;
        
        while (!found && offset < 200) {
          const searchResponse = await fetch(
            `https://api.brevo.com/v3/companies?limit=${limit}&offset=${offset}`,
            {
              method: 'GET',
              headers: {
                accept: 'application/json',
                'api-key': brevoApiKey,
              },
            }
          );

          if (searchResponse.ok) {
            const searchData: any = await searchResponse.json();
            const foundCompany = searchData.companies?.find(
              (c: any) => c.name?.toLowerCase() === startupName.toLowerCase()
            );
            if (foundCompany) {
              companyId = foundCompany.id;
              found = true;
              break;
            }
            
            if (!searchData.companies || searchData.companies.length < limit) {
              break;
            }
            
            offset += limit;
          } else {
            break;
          }
        }
      }
    }

    if (companyId && contactId) {
      const contactIdNum =
        typeof contactId === 'number' ? contactId : parseInt(String(contactId), 10);
      
      if (!isNaN(contactIdNum)) {
        const patchPayload: BrevoLinkCompanyPayload = {
          linkContactIds: [contactIdNum],
        };

        await fetch(
          `https://api.brevo.com/v3/companies/link-unlink/${companyId}`,
          {
            method: 'PATCH',
            headers: {
              accept: 'application/json',
              'api-key': brevoApiKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify(patchPayload),
          }
        );
      }
    }

    const contactFullName = `${firstName} ${lastName}`.trim();
    const thankYouEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Merci pour votre intérêt !</h2>
        <p>Bonjour ${escapeHtml(contactFullName)},</p>
        <p>Nous avons bien reçu votre demande de contact concernant <strong>${escapeHtml(startupName)}</strong>.</p>
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
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(thankYouEmailPayload),
    });

    const emailText = await emailResponse.text();

    if (!emailResponse.ok) {
      return response.status(500).json({ 
        error: 'Failed to send thank you email',
        details: emailText 
      });
    }

    try {
      const emailResult: any = JSON.parse(emailText);
      return response.status(200).json({ 
        success: true,
        messageId: emailResult.messageId,
        contactAdded: contactAdded,
        contactId: contactId,
        companyId: companyId,
        companyLinked: companyId && contactId ? true : false,
      });
    } catch (parseError) {
      return response.status(200).json({ 
        success: true,
        contactAdded: contactAdded,
        contactId: contactId,
        companyId: companyId,
        companyLinked: companyId && contactId ? true : false,
      });
    }

  } catch (error) {
    console.error('✗ Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    return response.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function cleanPhoneNumber(phone: string | undefined): string | null {
  if (!phone) {
    return null;
  }
  
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  
  if (!cleaned || cleaned.length < 4) {
    return null;
  }
  
  if (cleaned.startsWith('+')) {
    if (cleaned.length < 4) {
      return null;
    }
    return cleaned;
  }
  
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }
  
  if (cleaned.startsWith('0')) {
    return '+33' + cleaned.substring(1);
  }
  
  return '+' + cleaned;
}

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
