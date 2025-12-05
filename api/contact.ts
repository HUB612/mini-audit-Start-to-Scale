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
  console.log('=== CONTACT FORM HANDLER START ===');
  console.log(`Method: ${request.method}`);
  
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Récupérer les variables d'environnement
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@hub612.com';
  const brevoSenderName = process.env.BREVO_SENDER_NAME || 'Hub612';
  const brevoListId = process.env.BREVO_LIST_ID;

  console.log('Environment variables check:');
  console.log(`  BREVO_API_KEY: ${brevoApiKey ? 'SET' : 'MISSING'}`);
  console.log(`  BREVO_SENDER_EMAIL: ${brevoSenderEmail}`);
  console.log(`  BREVO_SENDER_NAME: ${brevoSenderName}`);
  console.log(`  BREVO_LIST_ID: ${brevoListId || 'MISSING'}`);

  if (!brevoApiKey) {
    console.error('✗ BREVO_API_KEY is not set');
    return response.status(500).json({ error: 'Server configuration error' });
  }

  if (!brevoListId) {
    console.error('✗ BREVO_LIST_ID is not set');
    return response.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Récupérer les données du formulaire
    const formData: ContactFormData = request.body;
    console.log('Form data received:', JSON.stringify(formData, null, 2));

    // Valider les champs requis
    if (!formData.startup_name || !formData.contact_firstname || !formData.contact_lastname || !formData.contact_email) {
      console.error('✗ Missing required fields');
      return response.status(400).json({ 
        error: 'Missing required fields: startup_name, contact_firstname, contact_lastname, contact_email' 
      });
    }

    const firstName = formData.contact_firstname.trim();
    const lastName = formData.contact_lastname.trim();
    const startupName = formData.startup_name.trim();

    console.log(`\n=== STEP 1: CREATE CONTACT ===`);
    console.log(`Contact: FirstName: "${firstName}", LastName: "${lastName}", Email: "${formData.contact_email}"`);

    // Nettoyer le numéro de téléphone
    const cleanedPhone = cleanPhoneNumber(formData.contact_phone);
    if (cleanedPhone) {
      console.log(`Phone cleaned: ${cleanedPhone}`);
    }

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

    console.log(`Contact attributes:`, JSON.stringify(contactAttributes, null, 2));

    const contactPayload: any = {
      email: formData.contact_email,
      attributes: contactAttributes,
      listIds: [parseInt(brevoListId, 10)],
      updateEnabled: true,
    };

    console.log(`Creating contact with payload:`, JSON.stringify(contactPayload, null, 2));

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
    
    console.log(`Contact creation response status: ${contactResponseStatus}`);
    console.log(`Contact creation response body: ${contactResponseText}`);

    if (!addContactResponse.ok) {
      try {
        const errorData = JSON.parse(contactResponseText);
        
        if (errorData.code === 'duplicate_parameter') {
          console.log('⚠ Contact already exists, retrieving ID...');
          contactAdded = true;
          
          // Vérifier si c'est le SMS qui cause le conflit
          const isSmsConflict = errorData.metadata?.duplicate_identifiers?.includes('SMS');
          const isEmailConflict = errorData.metadata?.duplicate_identifiers?.includes('email');
          
          console.log(`Conflict detected - SMS: ${isSmsConflict}, Email: ${isEmailConflict}`);
          
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
            console.log(`✓ Contact ID retrieved by email: ${contactId}`);
            
            // Préparer les attributs à mettre à jour
            // Si le SMS cause un conflit, ne pas l'inclure dans la mise à jour
            const updateAttributes = { ...contactAttributes };
            if (isSmsConflict && !isEmailConflict) {
              console.log(`⚠ SMS conflict detected, updating without SMS attribute`);
              delete updateAttributes.SMS;
              delete updateAttributes.TELEPHONE;
            }
            
            // Mettre à jour les attributs
            const updatePayload = { attributes: updateAttributes };
            const updateResponse = await fetch(
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
            
            if (updateResponse.ok) {
              console.log(`✓ Contact attributes updated`);
            } else {
              const updateError = await updateResponse.text();
              console.error(`✗ Error updating contact: ${updateError}`);
            }
          } else {
            // Si la récupération par email a échoué
            if (isSmsConflict && !isEmailConflict) {
              // Le SMS est déjà associé à un autre contact, créer sans SMS
              console.log(`⚠ SMS conflict: phone number already associated with another contact`);
              console.log(`Creating contact without SMS attribute...`);
              
              // Créer le contact sans le SMS
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
              
              const retryStatus = retryResponse.status;
              const retryText = await retryResponse.text();
              
              console.log(`Retry (without SMS) response status: ${retryStatus}`);
              console.log(`Retry (without SMS) response body: ${retryText}`);
              
              if (retryResponse.ok) {
                const retryResult: any = JSON.parse(retryText);
                contactId = retryResult.id;
                console.log(`✓ Contact created without SMS: ID ${contactId}`);
              } else {
                // Si ça échoue encore, analyser l'erreur
                try {
                  const retryErrorData = JSON.parse(retryText);
                  
                  // Si c'est encore un duplicate_parameter pour l'email, le contact existe déjà
                  if (retryErrorData.code === 'duplicate_parameter' && 
                      retryErrorData.metadata?.duplicate_identifiers?.includes('email')) {
                    console.log(`⚠ Email also exists, retrieving contact by email...`);
                    
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
                      console.log(`✓ Contact ID retrieved on final attempt: ${contactId}`);
                      
                      // Mettre à jour les attributs sans SMS
                      const updateAttributes = {
                        FIRSTNAME: firstName,
                        LASTNAME: lastName,
                        STARTUP: startupName,
                        MESSAGE: formData.message || '',
                      };
                      
                      const updatePayload = { attributes: updateAttributes };
                      const updateResponse = await fetch(
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
                      
                      if (updateResponse.ok) {
                        console.log(`✓ Contact attributes updated (without SMS)`);
                      } else {
                        const updateError = await updateResponse.text();
                        console.error(`✗ Error updating contact: ${updateError}`);
                      }
                    } else {
                      console.error(`✗ Failed to retrieve existing contact after retry`);
                    }
                  } else {
                    console.error(`✗ Retry failed with unexpected error: ${retryText}`);
                  }
                } catch (parseRetryError) {
                  console.error(`✗ Error parsing retry response: ${retryText}`);
                }
              }
            } else {
              console.error(`✗ Failed to retrieve existing contact`);
            }
          }
        } else {
          console.error(`✗ Failed to create contact: ${contactResponseText}`);
        }
      } catch (parseError) {
        console.error(`✗ Error parsing contact creation response:`, parseError);
      }
    } else {
      try {
        const contactResult: any = JSON.parse(contactResponseText);
        contactAdded = true;
        contactId = contactResult.id;
        console.log(`✓✓✓ Contact created successfully: ID ${contactId}`);
      } catch (parseError) {
        console.error(`✗ Error parsing contact creation response:`, parseError);
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
          console.log(`✓ Contact ID retrieved via GET: ${contactId}`);
        }
      } catch (getError) {
        console.error(`✗ Error retrieving contact ID:`, getError);
      }
    }

    if (!contactId) {
      console.error(`✗✗✗ CRITICAL: No contactId available, cannot proceed with company linking`);
    }

    console.log(`\n=== STEP 2: CREATE COMPANY ===`);
    let companyId: string | null = null;
    
    if (contactId) {
      const createCompanyPayload = {
        name: startupName,
        attributes: {},
      };

      console.log(`Creating company with payload:`, JSON.stringify(createCompanyPayload, null, 2));

      const createCompanyResponse = await fetch('https://api.brevo.com/v3/companies', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(createCompanyPayload),
      });

      const companyResponseStatus = createCompanyResponse.status;
      const companyResponseText = await createCompanyResponse.text();
      
      console.log(`Company creation response status: ${companyResponseStatus}`);
      console.log(`Company creation response body: ${companyResponseText}`);

      if (createCompanyResponse.ok) {
        try {
          const newCompany: any = JSON.parse(companyResponseText);
          companyId = newCompany.id;
          console.log(`✓✓✓ Company created successfully: ID ${companyId}`);
        } catch (parseError) {
          console.error(`✗ Error parsing company creation response:`, parseError);
        }
      } else {
        console.log(`⚠ Company creation failed, searching for existing company...`);
        
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
              console.log(`✓ Company found: ID ${companyId}`);
              found = true;
              break;
            }
            
            if (!searchData.companies || searchData.companies.length < limit) {
              break;
            }
            
            offset += limit;
          } else {
            const searchError = await searchResponse.text();
            console.error(`✗ Error searching for company: ${searchError}`);
            break;
          }
        }
        
        if (!found) {
          console.warn(`⚠ Company not found: ${startupName}`);
        }
      }
    } else {
      console.warn(`⚠ Skipping company creation: no contactId available`);
    }

    console.log(`\n=== STEP 3: LINK CONTACT TO COMPANY ===`);
    if (companyId && contactId) {
      const contactIdNum =
        typeof contactId === 'number' ? contactId : parseInt(String(contactId), 10);
      
      if (isNaN(contactIdNum)) {
        console.error(`✗✗✗ Invalid contactId: ${contactId} (not a number)`);
      } else {
        const patchPayload: BrevoLinkCompanyPayload = {
          linkContactIds: [contactIdNum],
        };
        
        console.log(`Patching company (link-unlink) ${companyId} with payload:`, JSON.stringify(patchPayload, null, 2));
        console.log(`URL: https://api.brevo.com/v3/companies/link-unlink/${companyId}`);

        const patchCompanyResponse = await fetch(
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

        const patchStatus = patchCompanyResponse.status;
        const patchText = await patchCompanyResponse.text();
        
        console.log(`PATCH (link-unlink) response status: ${patchStatus}`);
        console.log(`PATCH (link-unlink) response body: ${patchText}`);

        if (patchCompanyResponse.ok) {
          console.log(`✓✓✓ SUCCESS: Contact ${contactIdNum} linked to company ${companyId}`);
        } else {
          try {
            const errorData = JSON.parse(patchText);
            console.error(`✗✗✗ FAILED to link contact to company:`);
            console.error(`  Status: ${patchStatus}`);
            console.error(`  Error code: ${errorData.code}`);
            console.error(`  Error message: ${errorData.message}`);
          } catch (parseError) {
            console.error(`✗✗✗ FAILED to link contact to company (non-JSON):`);
            console.error(`  Status: ${patchStatus}`);
            console.error(`  Response: ${patchText}`);
          }
        }
      }
    } else {
      if (!companyId) {
        console.warn(`⚠ Cannot link: companyId is null`);
      }
      if (!contactId) {
        console.warn(`⚠ Cannot link: contactId is null`);
      }
    }

    console.log(`\n=== STEP 4: SEND THANK YOU EMAIL ===`);
    console.log(`Preparing email to: ${formData.contact_email}`);
    console.log(`Sender: ${brevoSenderName} <${brevoSenderEmail}>`);

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

    console.log(`Email payload:`, JSON.stringify({
      ...thankYouEmailPayload,
      htmlContent: '[HTML content]',
    }, null, 2));

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(thankYouEmailPayload),
    });

    const emailStatus = emailResponse.status;
    const emailText = await emailResponse.text();
    
    console.log(`Email response status: ${emailStatus}`);
    console.log(`Email response body: ${emailText}`);

    if (!emailResponse.ok) {
      console.error(`✗✗✗ FAILED to send thank you email:`);
      console.error(`  Status: ${emailStatus}`);
      console.error(`  Response: ${emailText}`);
      return response.status(500).json({ 
        error: 'Failed to send thank you email',
        details: emailText 
      });
    }

    try {
      const emailResult: any = JSON.parse(emailText);
      console.log(`✓✓✓ SUCCESS: Thank you email sent`);
      console.log(`  Message ID: ${emailResult.messageId}`);
      console.log(`  To: ${formData.contact_email}`);

      console.log(`\n=== CONTACT FORM HANDLER END ===`);
      return response.status(200).json({ 
        success: true,
        messageId: emailResult.messageId,
        contactAdded: contactAdded,
        contactId: contactId,
        companyId: companyId,
        companyLinked: companyId && contactId ? true : false,
      });
    } catch (parseError) {
      console.error(`✗ Error parsing email response:`, parseError);
      console.log(`Email response text: ${emailText}`);
      
      console.log(`\n=== CONTACT FORM HANDLER END ===`);
      return response.status(200).json({ 
        success: true,
        contactAdded: contactAdded,
        contactId: contactId,
        companyId: companyId,
        companyLinked: companyId && contactId ? true : false,
      });
    }

  } catch (error) {
    console.error(`\n✗✗✗ UNEXPECTED ERROR:`, error);
    console.error(`Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    console.log(`\n=== CONTACT FORM HANDLER END (ERROR) ===`);
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
