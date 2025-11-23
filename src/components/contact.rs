use yew::prelude::*;
use wasm_bindgen::JsCast;
use crate::app::FormData;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub form_data: FormData,
    pub form_submitted: bool,
    pub on_update: Callback<(String, String)>,
    pub on_submit: Callback<()>,
    pub on_back: Callback<()>,
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

    if props.form_submitted {
        html! {
            <div class="screen active">
                <div class="container">
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
                <div class="container">
                    <h2>{"Contactez-nous"}</h2>
                    <p class="contact-intro">
                        {"Remplissez ce formulaire et notre équipe vous recontactera rapidement pour discuter du programme Start to Scale."}
                    </p>
                    
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
                            />
                        </div>
                        
                        <div class="form-group">
                            <label for="contact-phone">{"Téléphone (optionnel)"}</label>
                            <input 
                                type="tel" 
                                id="contact-phone" 
                                value={props.form_data.contact_phone.clone()}
                                oninput={on_contact_phone}
                            />
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
                            <button type="button" onclick={on_back} class="btn btn-secondary">
                                {"Retour aux résultats"}
                            </button>
                            <button type="submit" class="btn btn-primary">{"Envoyer"}</button>
                        </div>
                    </form>
                </div>
            </div>
        }
    }
}

