use crate::app::FormData;
use wasm_bindgen::JsCast;
use yew::prelude::*;

// Fonction de validation d'email
fn is_valid_email(email: &str) -> bool {
    let email = email.trim();

    if !email.contains('@') {
        return false;
    }

    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return false;
    }

    let local = parts[0];
    let domain = parts[1];

    if local.is_empty() || !domain.contains('.') {
        return false;
    }

    if let Some(last_dot) = domain.rfind('.') {
        if domain.len() - last_dot - 1 < 2 {
            return false;
        }
    } else {
        return false;
    }

    for c in local.chars() {
        if !c.is_ascii_alphanumeric() && c != '.' && c != '_' && c != '-' && c != '+' && c != '%' {
            return false;
        }
    }

    for c in domain.chars() {
        if !c.is_ascii_alphanumeric() && c != '.' && c != '-' {
            return false;
        }
    }

    true
}

// Fonction de validation de téléphone
fn is_valid_phone(phone: &str) -> bool {
    let phone = phone.trim();

    if phone.is_empty() {
        return true;
    }

    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();

    if digits.len() < 8 || digits.len() > 15 {
        return false;
    }

    let valid_chars: Vec<char> = phone
        .chars()
        .filter(|c| {
            c.is_ascii_digit()
                || *c == '+'
                || *c == ' '
                || *c == '-'
                || *c == '('
                || *c == ')'
                || *c == '.'
        })
        .collect();

    valid_chars.len() == phone.chars().count()
}

#[derive(Properties, PartialEq)]
pub struct Props {
    pub form_data: FormData,
    pub form_submitted: bool,
    pub form_error: Option<String>,
    pub form_submitting: bool,
    pub on_update: Callback<(String, String)>,
    pub on_submit: Callback<()>,
    pub on_back: Callback<()>,
    pub on_go_to_welcome: Callback<()>,
}

#[function_component]
pub fn ContactScreen(props: &Props) -> Html {
    let on_startup_name = {
        let callback = props.on_update.clone();
        Callback::from(move |e: web_sys::InputEvent| {
            if let Some(target) = e.target() {
                if let Ok(input) = target.dyn_into::<web_sys::HtmlInputElement>() {
                    callback.emit(("startup_name".to_string(), input.value()));
                }
            }
        })
    };

    let on_contact_name = {
        let callback = props.on_update.clone();
        Callback::from(move |e: web_sys::InputEvent| {
            if let Some(target) = e.target() {
                if let Ok(input) = target.dyn_into::<web_sys::HtmlInputElement>() {
                    callback.emit(("contact_name".to_string(), input.value()));
                }
            }
        })
    };

    let on_contact_email = {
        let callback = props.on_update.clone();
        Callback::from(move |e: web_sys::InputEvent| {
            if let Some(target) = e.target() {
                if let Ok(input) = target.dyn_into::<web_sys::HtmlInputElement>() {
                    callback.emit(("contact_email".to_string(), input.value()));
                }
            }
        })
    };

    let on_contact_phone = {
        let callback = props.on_update.clone();
        Callback::from(move |e: web_sys::InputEvent| {
            if let Some(target) = e.target() {
                if let Ok(input) = target.dyn_into::<web_sys::HtmlInputElement>() {
                    callback.emit(("contact_phone".to_string(), input.value()));
                }
            }
        })
    };

    let on_message = {
        let callback = props.on_update.clone();
        Callback::from(move |e: web_sys::InputEvent| {
            if let Some(target) = e.target() {
                if let Ok(textarea) = target.dyn_into::<web_sys::HtmlTextAreaElement>() {
                    callback.emit(("message".to_string(), textarea.value()));
                }
            }
        })
    };

    let on_submit = {
        let callback = props.on_submit.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            callback.emit(());
        })
    };

    let on_back = {
        let callback = props.on_back.clone();
        Callback::from(move |_| callback.emit(()))
    };

    let on_logo_click = {
        let callback = props.on_go_to_welcome.clone();
        Callback::from(move |_| callback.emit(()))
    };

    if props.form_submitted {
        html! {
            <div class="screen active">
                <div class="container contact-container">
                    <div class="questions-header">
                        <div class="header-logo" onclick={on_logo_click} style="cursor: pointer;">
                            <img src="hub612-logo.webp" alt="HUB612" />
                        </div>
                    </div>
                    <div class="form-success">
                        <h3>{"✓ Merci !"}</h3>
                        <p>{"Votre demande a été envoyée. Notre équipe vous recontactera dans les plus brefs délais."}</p>
                    </div>
                </div>
            </div>
        }
    } else {
        html! {
            <div class="screen active">
                <div class="container contact-container">
                    <div class="questions-header">
                        <div class="header-logo" onclick={on_logo_click} style="cursor: pointer;">
                            <img src="hub612-logo.webp" alt="HUB612" />
                        </div>
                    </div>
                    <h2>{"Contactez-nous"}</h2>
                    <p class="contact-intro">
                        {"Remplissez ce formulaire et notre équipe vous recontactera rapidement pour discuter du programme Start to Scale."}
                    </p>

                    {if let Some(ref error) = props.form_error {
                        html! {
                            <div class="form-error" style="background-color: #fee; color: #c33; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                                <strong>{"Erreur : "}</strong>{error}
                            </div>
                        }
                    } else {
                        html! {}
                    }}

                    <form onsubmit={on_submit} class="contact-form">
                        <div class="form-group">
                            <label for="startup-name">{"Nom de votre startup *"}</label>
                            <input
                                type="text"
                                id="startup-name"
                                value={props.form_data.startup_name.clone()}
                                oninput={on_startup_name}
                                required={true}
                            />
                        </div>

                        <div class="form-group">
                            <label for="contact-name">{"Votre nom *"}</label>
                            <input
                                type="text"
                                id="contact-name"
                                value={props.form_data.contact_name.clone()}
                                oninput={on_contact_name}
                                required={true}
                            />
                        </div>

                        <div class="form-group">
                            <label for="contact-email">{"Votre email *"}</label>
                            <input
                                type="email"
                                id="contact-email"
                                value={props.form_data.contact_email.clone()}
                                oninput={on_contact_email}
                                required={true}
                                pattern={r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"}
                                title="Format d'email invalide (exemple: nom@exemple.com)"
                            />
                            {if !props.form_data.contact_email.is_empty() && !is_valid_email(&props.form_data.contact_email) {
                                html! {
                                    <span class="field-error" style="color: #c33; font-size: 0.875rem; display: block; margin-top: 0.25rem;">
                                        {"Format d'email invalide"}
                                    </span>
                                }
                            } else {
                                html! {}
                            }}
                        </div>

                        <div class="form-group">
                            <label for="contact-phone">{"Téléphone (optionnel)"}</label>
                            <input
                                type="tel"
                                id="contact-phone"
                                value={props.form_data.contact_phone.clone()}
                                oninput={on_contact_phone}
                                pattern={r"[\d\s\+\-\(\)\.]{8,}"}
                                title="Format de téléphone invalide (exemple: +33 6 12 34 56 78 ou 06 12 34 56 78)"
                            />
                            {if !props.form_data.contact_phone.is_empty() && !is_valid_phone(&props.form_data.contact_phone) {
                                html! {
                                    <span class="field-error" style="color: #c33; font-size: 0.875rem; display: block; margin-top: 0.25rem;">
                                        {"Format de téléphone invalide. Format attendu : +33 6 12 34 56 78 ou 06 12 34 56 78"}
                                    </span>
                                }
                            } else {
                                html! {}
                            }}
                        </div>

                        <div class="form-group">
                            <label for="contact-message">{"Message (optionnel)"}</label>
                            <textarea
                                id="contact-message"
                                value={props.form_data.message.clone()}
                                oninput={on_message}
                                rows="4"
                            ></textarea>
                        </div>

                        <div class="form-actions">
                            <button
                                type="button"
                                onclick={on_back}
                                class="btn btn-secondary"
                                disabled={props.form_submitting}
                            >
                                {"Retour aux résultats"}
                            </button>
                            <button
                                type="submit"
                                class="btn btn-primary"
                                disabled={props.form_submitting}
                            >
                                {if props.form_submitting {
                                    "Envoi en cours..."
                                } else {
                                    "Envoyer"
                                }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        }
    }
}
