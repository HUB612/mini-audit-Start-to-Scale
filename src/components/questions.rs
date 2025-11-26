use crate::survey::Survey;
use std::rc::Rc;
use yew::prelude::*;

#[derive(Properties)]
pub struct Props {
    pub survey: Rc<Survey>,
    pub current_index: usize,
    pub on_answer: Callback<String>,
    pub on_next: Callback<()>,
    pub on_previous: Callback<()>,
    pub on_show_results: Callback<()>,
    pub on_go_to_welcome: Callback<()>,
}

impl PartialEq for Props {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.survey, &other.survey) && self.current_index == other.current_index
    }
}

#[function_component]
pub fn QuestionsScreen(props: &Props) -> Html {
    let question_data = props.survey.get_question(props.current_index);
    let total = props.survey.total_questions();
    let progress = ((props.current_index + 1) as f64 / total as f64) * 100.0;

    let on_answer_oui = {
        let callback = props.on_answer.clone();
        Callback::from(move |_| callback.emit("oui".to_string()))
    };

    let on_answer_non = {
        let callback = props.on_answer.clone();
        Callback::from(move |_| callback.emit("non".to_string()))
    };

    let on_answer_je_sais_pas = {
        let callback = props.on_answer.clone();
        Callback::from(move |_| callback.emit("je-ne-sais-pas".to_string()))
    };

    let on_next = {
        let callback = if props.current_index == total - 1 {
            props.on_show_results.clone()
        } else {
            props.on_next.clone()
        };
        Callback::from(move |_| callback.emit(()))
    };

    let on_previous = {
        let callback = props.on_previous.clone();
        Callback::from(move |_| callback.emit(()))
    };

    let on_logo_click = {
        let callback = props.on_go_to_welcome.clone();
        Callback::from(move |_| callback.emit(()))
    };

    html! {
        <div class="screen active">
            <div class="container questions-container">
                <div class="questions-header">
                    <div class="header-logo" onclick={on_logo_click} style="cursor: pointer;">
                        <img src="hub612-logo.webp" alt="HUB612" />
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style={format!("width: {}%", progress)}></div>
                </div>
                <div class="progress-text">
                    <span>{format!("Question {} sur {}", props.current_index + 1, total)}</span>
                </div>

                <div class="thematic-header">
                    <h3>{&question_data.thematic}</h3>
                </div>

                <div class="question-container">
                    <h2>{&question_data.question.text}</h2>
                    {if let Some(ref desc) = question_data.question.description {
                        html! {
                            <p class="question-description">{desc}</p>
                        }
                    } else {
                        html! {}
                    }}

                    <div class="answers">
                        <button
                            onclick={on_answer_oui}
                            class={classes!("answer-btn", if question_data.answer.as_ref().map(|a| a == "oui").unwrap_or(false) { "selected" } else { "" }, "answer-oui")}
                        >
                            <span class="answer-icon">{"✓"}</span>
                            <span>{"Oui"}</span>
                        </button>
                        <button
                            onclick={on_answer_non}
                            class={classes!("answer-btn", if question_data.answer.as_ref().map(|a| a == "non").unwrap_or(false) { "selected" } else { "" }, "answer-non")}
                        >
                            <span class="answer-icon">{"✗"}</span>
                            <span>{"Non"}</span>
                        </button>
                        <button
                            onclick={on_answer_je_sais_pas}
                            class={classes!("answer-btn", if question_data.answer.as_ref().map(|a| a == "je-ne-sais-pas").unwrap_or(false) { "selected" } else { "" }, "answer-je-ne-sais-pas")}
                        >
                            <span class="answer-icon">{"?"}</span>
                            <span>{"Je ne sais pas"}</span>
                        </button>
                    </div>
                </div>

                <div class="navigation">
                    <button
                        onclick={on_previous}
                        class="btn btn-secondary"
                        disabled={props.current_index == 0}
                    >
                        {"Précédent"}
                    </button>
                    <button onclick={on_next} class="btn btn-primary">
                        {if props.current_index == total - 1 {
                            "Voir les résultats"
                        } else {
                            "Suivant"
                        }}
                    </button>
                </div>
            </div>
        </div>
    }
}
