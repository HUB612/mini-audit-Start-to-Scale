use crate::components::{ContactScreen, QuestionsScreen, ResultsScreen, WelcomeScreen};
use crate::survey::Survey;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;
use web_sys::RequestInit;
use yew::prelude::*;

pub enum Screen {
    Welcome,
    Questions,
    Results,
    Contact,
}

pub struct App {
    screen: Screen,
    survey: Option<Rc<Survey>>,
    current_question_index: usize,
    results: Option<crate::models::SurveyResults>,
    form_data: FormData,
    form_submitted: bool,
    form_error: Option<String>,
    form_submitting: bool,
}

#[derive(Clone, Default, PartialEq)]
pub struct FormData {
    pub startup_name: String,
    pub contact_name: String,
    pub contact_email: String,
    pub contact_phone: String,
    pub message: String,
}

impl Component for App {
    type Message = Msg;
    type Properties = ();

    fn create(_ctx: &Context<Self>) -> Self {
        Self {
            screen: Screen::Welcome,
            survey: None,
            current_question_index: 0,
            results: None,
            form_data: FormData::default(),
            form_submitted: false,
            form_error: None,
            form_submitting: false,
        }
    }

    fn update(&mut self, ctx: &Context<Self>, msg: Self::Message) -> bool {
        match msg {
            Msg::StartSurvey => {
                let survey = Rc::new(Survey::new());
                self.survey = Some(survey);
                self.current_question_index = 0;
                self.screen = Screen::Questions;
                true
            }
            Msg::AnswerQuestion(answer) => {
                if let Some(ref survey) = self.survey {
                    survey.answer_question(self.current_question_index, &answer);
                }
                self.next_question();
                true
            }
            Msg::NextQuestion => {
                self.next_question();
                true
            }
            Msg::PreviousQuestion => {
                if self.current_question_index > 0 {
                    self.current_question_index -= 1;
                }
                true
            }
            Msg::ShowResults => {
                if let Some(ref survey) = self.survey {
                    self.results = Some(survey.get_results());
                    self.screen = Screen::Results;
                }
                true
            }
            Msg::ShowContact => {
                self.screen = Screen::Contact;
                true
            }
            Msg::BackToResults => {
                self.screen = Screen::Results;
                true
            }
            Msg::UpdateFormField(field, value) => {
                match field.as_str() {
                    "startup_name" => self.form_data.startup_name = value,
                    "contact_name" => self.form_data.contact_name = value,
                    "contact_email" => self.form_data.contact_email = value,
                    "contact_phone" => self.form_data.contact_phone = value,
                    "message" => self.form_data.message = value,
                    _ => {}
                }
                true
            }
            Msg::SubmitForm => {
                if self.form_submitting {
                    return false;
                }

                self.form_submitting = true;
                self.form_error = None;

                let form_data = self.form_data.clone();
                let link = ctx.link().clone();

                spawn_local(async move {
                    let json_data = serde_json::json!({
                        "startup_name": form_data.startup_name,
                        "contact_name": form_data.contact_name,
                        "contact_email": form_data.contact_email,
                        "contact_phone": form_data.contact_phone,
                        "message": form_data.message,
                    });

                    let json_string = json_data.to_string();

                    let mut opts = RequestInit::new();
                    opts.set_method("POST");
                    opts.set_mode(web_sys::RequestMode::Cors);

                    let headers = web_sys::Headers::new().unwrap();
                    headers.set("Content-Type", "application/json").unwrap();
                    opts.set_headers(&headers);

                    let body = JsValue::from_str(&json_string);
                    opts.set_body(Some(&body));

                    let url = "/api/contact";
                    let request = match web_sys::Request::new_with_str_and_init(url, &opts) {
                        Ok(req) => req,
                        Err(err) => {
                            let error_msg =
                                format!("Erreur lors de la création de la requête: {:?}", err);
                            link.send_message(Msg::FormSubmitError(error_msg));
                            return;
                        }
                    };

                    match wasm_bindgen_futures::JsFuture::from(
                        web_sys::window().unwrap().fetch_with_request(&request),
                    )
                    .await
                    {
                        Ok(response_val) => {
                            let resp: web_sys::Response = match response_val.dyn_into() {
                                Ok(r) => r,
                                Err(_) => {
                                    link.send_message(Msg::FormSubmitError(
                                        "Réponse invalide".to_string(),
                                    ));
                                    return;
                                }
                            };

                            if resp.ok() {
                                link.send_message(Msg::FormSubmitSuccess);
                            } else {
                                let error_text = match resp.text() {
                                    Ok(text_future) => {
                                        match wasm_bindgen_futures::JsFuture::from(text_future)
                                            .await
                                        {
                                            Ok(text) => text
                                                .as_string()
                                                .unwrap_or_else(|| "Erreur inconnue".to_string()),
                                            Err(_) => "Erreur lors de la lecture de la réponse"
                                                .to_string(),
                                        }
                                    }
                                    Err(_) => format!("Erreur HTTP: {}", resp.status()),
                                };
                                link.send_message(Msg::FormSubmitError(error_text));
                            }
                        }
                        Err(err) => {
                            let error_msg = format!("Erreur réseau: {:?}", err);
                            link.send_message(Msg::FormSubmitError(error_msg));
                        }
                    }
                });

                true
            }
            Msg::FormSubmitSuccess => {
                self.form_submitted = true;
                self.form_submitting = false;
                self.form_error = None;
                true
            }
            Msg::FormSubmitError(error) => {
                self.form_submitting = false;
                self.form_error = Some(error);
                true
            }
            Msg::GoToWelcome => {
                self.screen = Screen::Welcome;
                self.survey = None;
                self.current_question_index = 0;
                self.results = None;
                self.form_data = FormData::default();
                self.form_submitted = false;
                self.form_error = None;
                self.form_submitting = false;
                true
            }
        }
    }

    fn view(&self, ctx: &Context<Self>) -> Html {
        html! {
            <div id="app">
                {match &self.screen {
                    Screen::Welcome => html! {
                        <WelcomeScreen on_start={ctx.link().callback(|_| Msg::StartSurvey)} />
                    },
                    Screen::Questions => {
                        if let Some(ref survey) = self.survey {
                            html! {
                                <QuestionsScreen
                                    survey={Rc::clone(survey)}
                                    current_index={self.current_question_index}
                                    on_answer={ctx.link().callback(Msg::AnswerQuestion)}
                                    on_next={ctx.link().callback(|_| Msg::NextQuestion)}
                                    on_previous={ctx.link().callback(|_| Msg::PreviousQuestion)}
                                    on_show_results={ctx.link().callback(|_| Msg::ShowResults)}
                                    on_go_to_welcome={ctx.link().callback(|_| Msg::GoToWelcome)}
                                />
                            }
                        } else {
                            html! { <div>{"Erreur: Survey non initialisé"}</div> }
                        }
                    },
                    Screen::Results => {
                        if let Some(ref results) = self.results {
                            html! {
                                <ResultsScreen
                                    results={(*results).clone()}
                                    on_contact={ctx.link().callback(|_| Msg::ShowContact)}
                                    on_go_to_welcome={ctx.link().callback(|_| Msg::GoToWelcome)}
                                />
                            }
                        } else {
                            html! { <div>{"Aucun résultat disponible"}</div> }
                        }
                    },
                    Screen::Contact => html! {
                        <ContactScreen
                            form_data={self.form_data.clone()}
                            form_submitted={self.form_submitted}
                            form_error={self.form_error.clone()}
                            form_submitting={self.form_submitting}
                            on_update={ctx.link().callback(|(field, value)| Msg::UpdateFormField(field, value))}
                            on_submit={ctx.link().callback(|_| Msg::SubmitForm)}
                            on_back={ctx.link().callback(|_| Msg::BackToResults)}
                            on_go_to_welcome={ctx.link().callback(|_| Msg::GoToWelcome)}
                        />
                    },
                }}
            </div>
        }
    }
}

impl App {
    fn next_question(&mut self) {
        if let Some(ref survey) = self.survey {
            if self.current_question_index < survey.total_questions() - 1 {
                self.current_question_index += 1;
            } else {
                self.results = Some(survey.get_results());
                self.screen = Screen::Results;
            }
        }
    }
}

pub enum Msg {
    StartSurvey,
    AnswerQuestion(String),
    NextQuestion,
    PreviousQuestion,
    ShowResults,
    ShowContact,
    BackToResults,
    UpdateFormField(String, String),
    SubmitForm,
    FormSubmitSuccess,
    FormSubmitError(String),
    GoToWelcome,
}
