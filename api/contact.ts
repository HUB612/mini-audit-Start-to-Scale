import type { VercelRequest, VercelResponse } from '@vercel/node';

interface QuestionData {
  question: {
    id: string;
    text: string;
    description?: string;
    thematic: string;
  };
  thematic: string;
  answer?: string;
}

interface ContactFormData {
  startup_name: string;
  contact_firstname: string;
  contact_lastname: string;
  contact_email: string;
  contact_phone?: string;
  message?: string;
  questions?: QuestionData[];
  scores?: { [key: string]: number };
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
    console.log('📥 [CONTACT] Début du traitement de la requête');
    
    // Récupérer les données du formulaire
    const formData: ContactFormData = request.body;
    console.log('📋 [CONTACT] Données reçues:', {
      startup_name: formData.startup_name,
      contact_email: formData.contact_email,
      contact_firstname: formData.contact_firstname,
      contact_lastname: formData.contact_lastname,
      has_questions: !!formData.questions,
      questions_count: formData.questions?.length || 0,
      has_scores: !!formData.scores,
      scores_count: formData.scores ? Object.keys(formData.scores).length : 0,
    });

    // Valider les champs requis
    if (!formData.startup_name || !formData.contact_firstname || !formData.contact_lastname || !formData.contact_email) {
      console.error('✗ [CONTACT] Champs requis manquants');
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
      PRENOM: firstName,
      NOM: lastName,
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

    console.log('👤 [CONTACT] Création/mise à jour du contact dans Brevo...');
    console.log('📤 [CONTACT] Payload envoyé:', JSON.stringify(contactPayload, null, 2));
    
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
    console.log(`📥 [CONTACT] Réponse Brevo - Status: ${contactResponseStatus}`);
    console.log('📥 [CONTACT] Réponse Brevo - Body:', contactResponseText);

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
            console.log(`✅ [CONTACT] Contact existant trouvé - ID: ${contactId}`);
            console.log('📋 [CONTACT] Données actuelles du contact:', {
              email: contactData.email,
              firstName: contactData.attributes?.FIRSTNAME || contactData.attributes?.PRENOM,
              lastName: contactData.attributes?.LASTNAME || contactData.attributes?.NOM,
            });
            
            // Préparer les attributs à mettre à jour
            // S'assurer que FIRSTNAME/LASTNAME et PRENOM/NOM sont toujours inclus
            const updateAttributes = { 
              PRENOM: firstName,
              NOM: lastName,
            };
            if (cleanedPhone && (!isSmsConflict || isEmailConflict)) {
              updateAttributes.SMS = cleanedPhone;
              updateAttributes.TELEPHONE = cleanedPhone;
            }
            if (isSmsConflict && !isEmailConflict) {
              delete updateAttributes.SMS;
              delete updateAttributes.TELEPHONE;
            }
            
            // Mettre à jour les attributs
            const updatePayload = { attributes: updateAttributes };
            console.log('🔄 [CONTACT] Mise à jour du contact existant...');
            console.log('📤 [CONTACT] Payload de mise à jour:', JSON.stringify(updatePayload, null, 2));
            
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
            
            const updateResponseStatus = updateResponse.status;
            const updateResponseText = await updateResponse.text();
            console.log(`📥 [CONTACT] Réponse mise à jour - Status: ${updateResponseStatus}`);
            console.log('📥 [CONTACT] Réponse mise à jour - Body:', updateResponseText);
            
            if (!updateResponse.ok) {
              console.error('✗ [CONTACT] Échec de la mise à jour du contact');
            } else {
              console.log('✅ [CONTACT] Contact mis à jour avec succès');
            }
          } else {
            // Si la récupération par email a échoué
            if (isSmsConflict && !isEmailConflict) {
              // Le SMS est déjà associé à un autre contact, créer sans SMS
              const contactPayloadWithoutSms: any = {
                email: formData.contact_email,
                attributes: {
                  PRENOM: firstName,
                  NOM: lastName,
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
                        PRENOM: firstName,
                        NOM: lastName,
                      };
                      
                      const updatePayload = { attributes: updateAttributes };
                      console.log('🔄 [CONTACT] Mise à jour finale du contact...');
                      console.log('📤 [CONTACT] Payload de mise à jour:', JSON.stringify(updatePayload, null, 2));
                      
                      const finalUpdateResponse = await fetch(
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
                      
                      const finalUpdateStatus = finalUpdateResponse.status;
                      const finalUpdateText = await finalUpdateResponse.text();
                      console.log(`📥 [CONTACT] Réponse mise à jour finale - Status: ${finalUpdateStatus}`);
                      console.log('📥 [CONTACT] Réponse mise à jour finale - Body:', finalUpdateText);
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
        console.log(`✅ [CONTACT] Contact créé avec succès - ID: ${contactId}`);
        
        // Vérifier que le contact a bien été créé avec les bons attributs
        console.log('🔍 [CONTACT] Vérification des attributs du contact créé...');
        const verifyResponse = await fetch(
          `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'api-key': brevoApiKey,
            },
          }
        );
        
        if (verifyResponse.ok) {
          const verifyData: any = await verifyResponse.json();
          console.log('📋 [CONTACT] Attributs vérifiés:', {
            email: verifyData.email,
            firstName: verifyData.attributes?.FIRSTNAME || verifyData.attributes?.PRENOM || 'NON DÉFINI',
            lastName: verifyData.attributes?.LASTNAME || verifyData.attributes?.NOM || 'NON DÉFINI',
            startup: verifyData.attributes?.STARTUP || 'NON DÉFINI',
          });
          
          // Si FIRSTNAME ou LASTNAME ne sont pas présents, essayer de les mettre à jour
          if (!verifyData.attributes?.FIRSTNAME && !verifyData.attributes?.PRENOM) {
            console.warn('⚠️ [CONTACT] FIRSTNAME manquant, tentative de mise à jour...');
            const fixAttributes = { FIRSTNAME: firstName, LASTNAME: lastName };
            await fetch(
              `https://api.brevo.com/v3/contacts/${encodeURIComponent(formData.contact_email)}`,
              {
                method: 'PUT',
                headers: {
                  accept: 'application/json',
                  'api-key': brevoApiKey,
                  'content-type': 'application/json',
                },
                body: JSON.stringify({ attributes: fixAttributes }),
              }
            );
          }
        }
      } catch (parseError) {
        console.error('✗ [CONTACT] Erreur lors du parsing de la réponse:', parseError);
        // Ignorer les erreurs de parsing
      }
    }

    // Récupérer contactId si nécessaire
    if (!contactId && contactAdded) {
      console.log('🔍 [CONTACT] Récupération du contactId par email...');
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
          console.log(`✅ [CONTACT] ContactId récupéré: ${contactId}`);
        } else {
          console.error(`✗ [CONTACT] Échec de la récupération du contact - Status: ${getContactResponse.status}`);
        }
      } catch (getError) {
        console.error('✗ [CONTACT] Erreur lors de la récupération du contact:', getError);
        // Ignorer les erreurs
      }
    }

    if (!contactId) {
      console.error('✗ [CONTACT] Aucun contactId disponible');
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
      console.log('🏢 [COMPANY] Création/recherche de l\'entreprise...');
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
      console.log(`📥 [COMPANY] Réponse Brevo - Status: ${createCompanyResponse.status}`);

      if (createCompanyResponse.ok) {
        try {
          const newCompany: any = JSON.parse(companyResponseText);
          companyId = newCompany.id;
          console.log(`✅ [COMPANY] Entreprise créée avec succès - ID: ${companyId}`);
        } catch (parseError) {
          console.error('✗ [COMPANY] Erreur lors du parsing de la réponse:', parseError);
          // Ignorer les erreurs de parsing
        }
      } else {
        console.log('🔍 [COMPANY] Entreprise existante, recherche en cours...');
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
              console.log(`✅ [COMPANY] Entreprise trouvée - ID: ${companyId}`);
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
      console.log(`🔗 [LINK] Liaison contact (${contactId}) <-> entreprise (${companyId})...`);
      const contactIdNum =
        typeof contactId === 'number' ? contactId : parseInt(String(contactId), 10);
      
      if (!isNaN(contactIdNum)) {
        const patchPayload: BrevoLinkCompanyPayload = {
          linkContactIds: [contactIdNum],
        };

        const linkResponse = await fetch(
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
        
        if (linkResponse.ok) {
          console.log(`✅ [LINK] Liaison réussie`);
        } else {
          const linkErrorText = await linkResponse.text();
          console.error(`✗ [LINK] Échec de la liaison - Status: ${linkResponse.status}`, linkErrorText);
        }
      } else {
        console.error(`✗ [LINK] ContactId invalide: ${contactId}`);
      }
    } else {
      console.log(`⚠️ [LINK] Liaison impossible - contactId: ${contactId}, companyId: ${companyId}`);
    }

    // Créer une note dans Brevo avec les résultats du questionnaire
    console.log('📝 [NOTE] Vérification des conditions pour créer la note...');
    console.log('📝 [NOTE] contactId:', contactId);
    console.log('📝 [NOTE] has_questions:', !!formData.questions);
    console.log('📝 [NOTE] has_scores:', !!formData.scores);
    
    if (contactId && formData.questions && formData.scores) {
      console.log('📝 [NOTE] Conditions remplies, création de la note...');
      await createBrevoNote(brevoApiKey, contactId, formData, startupName);
    } else {
      console.warn('⚠️ [NOTE] Conditions non remplies pour créer la note');
      if (!contactId) console.warn('  - contactId manquant');
      if (!formData.questions) console.warn('  - questions manquantes');
      if (!formData.scores) console.warn('  - scores manquants');
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

    console.log('📧 [EMAIL] Envoi de l\'email de remerciement...');
    
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
    console.log(`📥 [EMAIL] Réponse Brevo - Status: ${emailResponse.status}`);

    if (!emailResponse.ok) {
      console.error('✗ [EMAIL] Échec de l\'envoi de l\'email:', emailText);
      return response.status(500).json({ 
        error: 'Failed to send thank you email',
        details: emailText 
      });
    } else {
      console.log('✅ [EMAIL] Email envoyé avec succès');
    }

    try {
      const emailResult: any = JSON.parse(emailText);
      console.log('✅ [CONTACT] Traitement terminé avec succès');
      console.log('📊 [CONTACT] Résumé:', {
        contactAdded,
        contactId,
        companyId,
        companyLinked: companyId && contactId ? true : false,
        messageId: emailResult.messageId,
      });
      
      return response.status(200).json({ 
        success: true,
        messageId: emailResult.messageId,
        contactAdded: contactAdded,
        contactId: contactId,
        companyId: companyId,
        companyLinked: companyId && contactId ? true : false,
      });
    } catch (parseError) {
      console.log('✅ [CONTACT] Traitement terminé avec succès (réponse email non-JSON)');
      console.log('📊 [CONTACT] Résumé:', {
        contactAdded,
        contactId,
        companyId,
        companyLinked: companyId && contactId ? true : false,
      });
      
      return response.status(200).json({ 
        success: true,
        contactAdded: contactAdded,
        contactId: contactId,
        companyId: companyId,
        companyLinked: companyId && contactId ? true : false,
      });
    }

  } catch (error) {
    console.error('✗ [CONTACT] Erreur inattendue:', error instanceof Error ? error.message : 'Unknown error');
    console.error('✗ [CONTACT] Stack:', error instanceof Error ? error.stack : 'N/A');
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

async function createBrevoNote(
  apiKey: string,
  contactId: number,
  formData: ContactFormData,
  startupName: string
): Promise<void> {
  console.log('📝 [NOTE] Début de la création de la note');
  console.log('📝 [NOTE] Paramètres:', {
    contactId,
    startupName,
    questions_count: formData.questions?.length || 0,
    scores_count: formData.scores ? Object.keys(formData.scores).length : 0,
  });
  
  try {
    // Grouper les questions par thématique
    const questionsByThematic: { [key: string]: QuestionData[] } = {};
    if (formData.questions) {
      console.log('📝 [NOTE] Groupement des questions par thématique...');
      for (const q of formData.questions) {
        if (!questionsByThematic[q.thematic]) {
          questionsByThematic[q.thematic] = [];
        }
        questionsByThematic[q.thematic].push(q);
      }
      console.log('📝 [NOTE] Thématiques trouvées:', Object.keys(questionsByThematic));
    } else {
      console.warn('⚠️ [NOTE] Aucune question fournie');
    }

    // Construire le contenu de la note en HTML simple
    let noteContent = `<b>Résultats du questionnaire Start to Scale</b><br><br>`;
    noteContent += `<b>Startup:</b> ${escapeHtml(startupName)}<br><br>`;

    // Ajouter les scores par thématique
    if (formData.scores && Object.keys(formData.scores).length > 0) {
      noteContent += `<b>Scores par thématique:</b><br>`;
      const sortedThematics = Object.keys(formData.scores).sort();
      for (const thematic of sortedThematics) {
        const score = formData.scores[thematic];
        const percentage = Math.round(score);
        noteContent += `- ${escapeHtml(thematic)}: ${percentage}%<br>`;
      }
      noteContent += `<br>`;
    }

    // Ajouter les questions avec réponses par thématique
    if (Object.keys(questionsByThematic).length > 0) {
      noteContent += `<b>Questions et réponses:</b><br><br>`;
      const sortedThematics = Object.keys(questionsByThematic).sort();
      
      for (const thematic of sortedThematics) {
        const questions = questionsByThematic[thematic];
        noteContent += `<b>${escapeHtml(thematic)}</b><br>`;
        
        for (const qData of questions) {
          noteContent += `Q: ${escapeHtml(qData.question.text)}<br>`;
          if (qData.question.description) {
            noteContent += `<i>${escapeHtml(qData.question.description)}</i><br>`;
          }
          
          if (qData.answer) {
            const answerText = qData.answer === 'oui' ? 'Oui' : 
                              qData.answer === 'non' ? 'Non' : 
                              'Je ne sais pas';
            noteContent += `R: <b>${answerText}</b><br>`;
          } else {
            noteContent += `R: Non répondu<br>`;
          }
          noteContent += `<br>`;
        }
      }
    }

    // Ajouter le message du formulaire s'il existe
    if (formData.message && formData.message.trim()) {
      noteContent += `<b>Message du formulaire:</b><br>${escapeHtml(formData.message)}`;
    }

    // Créer la note dans Brevo
    console.log('📝 [NOTE] Préparation du payload pour Brevo...');
    console.log('📝 [NOTE] Longueur du contenu:', noteContent.length, 'caractères');
    
    const notePayload = {
      text: noteContent,
      contactIds: [contactId],
    };

    console.log('📝 [NOTE] Envoi de la requête à Brevo...');
    console.log('📝 [NOTE] Payload:', JSON.stringify(notePayload, null, 2));
    
    const noteResponse = await fetch('https://api.brevo.com/v3/crm/notes', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(notePayload),
    });

    const noteResponseStatus = noteResponse.status;
    const noteResponseText = await noteResponse.text();
    
    console.log(`📥 [NOTE] Réponse Brevo - Status: ${noteResponseStatus}`);
    console.log('📥 [NOTE] Réponse Brevo - Body:', noteResponseText);

    if (!noteResponse.ok) {
      console.error('✗ [NOTE] Échec de la création de la note');
      console.error('✗ [NOTE] Status:', noteResponseStatus);
      console.error('✗ [NOTE] Erreur:', noteResponseText);
    } else {
      try {
        const noteResult = JSON.parse(noteResponseText);
        console.log('✅ [NOTE] Note créée avec succès:', noteResult);
      } catch (parseError) {
        console.log('✅ [NOTE] Note créée avec succès (réponse non-JSON)');
      }
    }
  } catch (error) {
    console.error('✗ [NOTE] Erreur lors de la création de la note:', error instanceof Error ? error.message : 'Unknown error');
    console.error('✗ [NOTE] Stack:', error instanceof Error ? error.stack : 'N/A');
  }
}
