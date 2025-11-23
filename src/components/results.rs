use yew::prelude::*;
use wasm_bindgen::JsValue;
use crate::models::SurveyResults;
use web_sys::HtmlCanvasElement;
use wasm_bindgen::JsCast;


#[derive(Properties, PartialEq)]
pub struct Props {
    pub results: SurveyResults,
    pub on_contact: Callback<()>,
    pub on_go_to_welcome: Callback<()>,
}

fn get_global_message(score: f64) -> &'static str {
    if score <= 20.0 {
        "Votre startup a encore beaucoup de potentiel à développer ! Le programme Start to Scale vous accompagnera pour structurer votre croissance et accélérer votre développement."
    } else if score <= 40.0 {
        "Vous êtes sur la bonne voie, mais il reste des étapes importantes à franchir. Le programme Start to Scale peut vous aider à identifier les priorités et à structurer votre approche pour passer à l'échelle."
    } else if score <= 60.0 {
        "Vous avez de solides bases ! Le programme Start to Scale vous permettra d'optimiser vos processus et de renforcer les domaines qui nécessitent encore de l'attention pour accélérer votre croissance."
    } else if score <= 80.0 {
        "Félicitations, vous êtes bien avancé ! Le programme Start to Scale vous aidera à peaufiner les derniers détails et à maximiser votre potentiel de croissance. Même les meilleurs ont toujours des axes d'amélioration."
    } else {
        "Impressionnant ! Vous avez une maturité remarquable. Le programme Start to Scale vous accompagnera pour maintenir cette excellence, anticiper les défis du scaling et continuer à évoluer. Même au top, il y a toujours des opportunités d'optimisation !"
    }
}

fn get_feedback_message(thematic: &str, score: f64) -> &'static str {
    let score_range = if score <= 20.0 {
        0
    } else if score <= 40.0 {
        1
    } else if score <= 60.0 {
        2
    } else if score <= 80.0 {
        3
    } else {
        4
    };

    match (thematic, score_range) {
        ("Business Model", 0) => "Votre modèle économique est un peu comme un GPS sans signal : vous savez où vous voulez aller, mais le chemin reste flou. Pas de panique, on va tracer la route ensemble !",
        ("Business Model", 1) => "Votre business model commence à prendre forme, mais il manque encore quelques pièces du puzzle. C'est comme un IKEA sans notice : faisable, mais plus long !",
        ("Business Model", 2) => "Vous avez une base solide, mais il reste des zones d'ombre. C'est comme avoir une recette sans les quantités exactes : ça peut marcher, mais c'est risqué !",
        ("Business Model", 3) => "Votre modèle économique est bien structuré ! Il ne manque plus que quelques ajustements pour passer à la vitesse supérieure. On dirait presque un pro !",
        ("Business Model", 4) => "Remarquable ! Votre business model est solide comme un roc. Vous êtes prêt à scaler, mais même les meilleurs ont toujours des axes d'amélioration !",
        
        ("Produit", 0) => "Votre produit semble être en mode 'stealth mode' : invisible, même pour vous ! Il est temps de sortir de l'ombre et de voir ce qui se passe vraiment.",
        ("Produit", 1) => "Vous commencez à avoir une idée de ce qui se passe dans votre produit, mais c'est encore un peu flou. C'est comme regarder à travers une vitre embuée : on devine, mais on ne voit pas tout !",
        ("Produit", 2) => "Vous avez mis en place quelques outils de suivi, mais il manque encore des pièces du puzzle. C'est comme avoir un tableau de bord avec la moitié des voyants éteints !",
        ("Produit", 3) => "Chapeau ! Votre produit est bien instrumenté. Vous avez une bonne vision de ce qui se passe, avec juste quelques angles morts à éclaircir.",
        ("Produit", 4) => "Parfait ! Votre produit est sous surveillance rapprochée. Vous savez tout (ou presque) de ce qui s'y passe. Un vrai pro de la data !",
        
        ("Go-to-Market", 0) => "Votre stratégie go-to-market est un peu comme lancer une bouteille à la mer : vous espérez que quelqu'un la trouvera, mais vous ne savez pas qui ni quand !",
        ("Go-to-Market", 1) => "Vous avez quelques idées sur comment aller au marché, mais c'est encore un peu au feeling. C'est comme naviguer sans boussole : ça peut marcher, mais c'est risqué !",
        ("Go-to-Market", 2) => "Votre go-to-market prend forme, mais il manque encore de la structure. C'est comme avoir une carte sans légende : vous savez où vous êtes, mais pas comment arriver à destination !",
        ("Go-to-Market", 3) => "Votre stratégie go-to-market est bien rodée ! Vous avez les bons outils et les bons indicateurs. Il ne reste plus qu'à optimiser pour passer à la vitesse supérieure.",
        ("Go-to-Market", 4) => "Formidable ! Votre go-to-market est une machine bien huilée. Vous savez exactement où vous allez et comment y arriver. Un vrai stratège !",
        
        ("Organisation", 0) => "Votre organisation ressemble un peu à une ruche sans reine : tout le monde bouge, mais personne ne sait vraiment qui fait quoi ! Il est temps de structurer tout ça.",
        ("Organisation", 1) => "Vous avez commencé à organiser les choses, mais c'est encore un peu le bazar. C'est comme un tiroir à chaussettes : on trouve parfois, mais c'est rarement au bon endroit !",
        ("Organisation", 2) => "Votre organisation a une structure, mais elle pourrait être plus claire. C'est comme avoir un organigramme écrit sur un post-it : ça existe, mais c'est fragile !",
        ("Organisation", 3) => "Félicitations ! Votre organisation est bien structurée. Les rôles sont clairs et les processus en place. Il ne reste plus qu'à peaufiner les détails.",
        ("Organisation", 4) => "Exemplaire ! Votre organisation est au top. Tout est bien défini, documenté et rodé. Vous êtes prêt à scaler sans perdre en efficacité !",
        
        ("Financement", 0) => "Votre stratégie de financement est un peu comme chercher une aiguille dans une botte de foin : vous savez qu'elle existe, mais vous ne savez pas où la chercher !",
        ("Financement", 1) => "Vous avez quelques idées sur le financement, mais c'est encore flou. C'est comme avoir un compte en banque sans savoir combien il contient : vous espérez que c'est suffisant !",
        ("Financement", 2) => "Votre approche du financement est en cours de structuration. Vous avez les bases, mais il manque encore quelques éléments clés pour convaincre les investisseurs.",
        ("Financement", 3) => "Bien joué ! Votre stratégie de financement est solide. Vous avez les bons outils et les bons arguments. Il ne reste plus qu'à peaufiner pour maximiser vos chances.",
        ("Financement", 4) => "Exceptionnel ! Votre stratégie de financement est au point. Vous êtes prêt à lever des fonds comme un pro. Les investisseurs vont se battre pour vous !",
        
        _ => "Votre score indique qu'il y a encore du travail à faire, mais c'est normal ! Chaque startup a ses défis à relever.",
    }
}

#[function_component]
pub fn ResultsScreen(props: &Props) -> Html {
    let canvas_ref = use_node_ref();
    let on_contact = {
        let callback = props.on_contact.clone();
        Callback::from(move |_| callback.emit(()))
    };

    let on_logo_click = {
        let callback = props.on_go_to_welcome.clone();
        Callback::from(move |_| callback.emit(()))
    };

    {
        let canvas_ref = canvas_ref.clone();
        let scores = props.results.scores.clone();
        use_effect(move || {
            if let Some(canvas) = canvas_ref.cast::<HtmlCanvasElement>() {
                draw_radar_chart(&canvas, &scores);
            }
            || {}
        });
    }

    // Trier les thématiques pour un affichage cohérent
    let mut thematics: Vec<(&String, &f64)> = props.results.scores.iter().collect();
    thematics.sort_by(|a, b| a.0.cmp(b.0));

    // Calculer le score global (moyenne de tous les scores)
    let global_score = if props.results.scores.is_empty() {
        0.0
    } else {
        let sum: f64 = props.results.scores.values().sum();
        sum / props.results.scores.len() as f64
    };

    html! {
        <div class="screen active results-screen">
            <div class="container results-container">
                <div class="questions-header">
                    <div class="header-logo" onclick={on_logo_click} style="cursor: pointer;">
                        <img src="hub612-logo.webp" alt="HUB612" />
                    </div>
                </div>
                <h2>{"Vos résultats"}</h2>
                <p class="results-intro">
                    {"Voici votre profil de maturité sur les différentes thématiques du programme Start to Scale."}
                </p>
                
                <div class="radar-chart-container">
                    <div class="global-score">
                        <span class="global-score-label">{"Score global"}</span>
                        <span class="global-score-value">{format!("{}%", global_score.round() as u32)}</span>
                        <p class="global-score-message">{get_global_message(global_score)}</p>
                    </div>
                    <h3>{"Analyse détaillée"}</h3>
                    <canvas ref={canvas_ref}></canvas>
                    <div class="feedback-list">
                        {for thematics.iter().map(|(thematic, score)| {
                            let message = get_feedback_message(thematic, **score);
                            html! {
                                <div class="feedback-item">
                                    <div class="feedback-header">
                                        <h4>{thematic}</h4>
                                        <span class="feedback-score">{format!("{}%", score.round() as u32)}</span>
                                    </div>
                                    <p class="feedback-message">{message}</p>
                                </div>
                            }
                        })}
                    </div>
                </div>

                <div class="cta-section">
                    <h3>{"Prêt à passer à l'étape suivante ?"}</h3>
                    <p>{"Le programme Start to Scale peut vous aider à structurer votre croissance et accélérer votre développement."}</p>
                    <button onclick={on_contact} class="btn btn-primary">
                        {"Être contacté pour plus d'informations"}
                    </button>
                </div>
            </div>
        </div>
    }
}

fn draw_radar_chart(canvas: &HtmlCanvasElement, scores: &std::collections::HashMap<String, f64>) {
    let container = canvas.parent_element().unwrap();
    let container_width = container.client_width();
    let max_size = container_width.min(600) as u32;
    // Augmenter la taille pour laisser de la place aux labels
    let size = max_size;
    canvas.set_width(size);
    canvas.set_height(size);

    let ctx = canvas
        .get_context("2d")
        .unwrap()
        .unwrap()
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .unwrap();

    let center_x = size as f64 / 2.0;
    let center_y = size as f64 / 2.0;
    // Réduire le radius pour laisser plus d'espace aux labels
    let radius = (center_x.min(center_y) - 80.0) as f64;

    // Dessiner les cercles de grille
    ctx.set_stroke_style_str("#e0e0e0");
    ctx.set_line_width(1.0);
    for i in 1..=5 {
        let r = (radius * i as f64) / 5.0;
        ctx.begin_path();
        ctx.arc(center_x, center_y, r, 0.0, std::f64::consts::PI * 2.0).unwrap();
        ctx.stroke();
    }

    // Dessiner les axes
    let thematics: Vec<&String> = scores.keys().collect();
    let angle_step = (std::f64::consts::PI * 2.0) / thematics.len() as f64;

    ctx.set_stroke_style_str("#999");
    ctx.set_line_width(1.0);
    for (index, thematic) in thematics.iter().enumerate() {
        let angle = (index as f64 * angle_step) - std::f64::consts::PI / 2.0;
        let x = center_x + angle.cos() * radius;
        let y = center_y + angle.sin() * radius;

        ctx.begin_path();
        ctx.move_to(center_x, center_y);
        ctx.line_to(x, y);
        ctx.stroke();

        // Labels avec scores
        let score = scores.get(*thematic).unwrap_or(&0.0);
        let score_text = format!("{}%", score.round() as u32);
        
        // Label de la thématique
        ctx.set_fill_style_str("#333");
        ctx.set_font("bold 11px Arial");
        ctx.set_text_align("center");
        ctx.set_text_baseline("middle");
        let label_x = center_x + angle.cos() * (radius + 35.0);
        let label_y = center_y + angle.sin() * (radius + 35.0);
        ctx.fill_text(thematic, label_x, label_y).unwrap();
        
        // Score en rouge, plus grand
        ctx.set_fill_style_str("#d32f2f");
        ctx.set_font("bold 16px Arial");
        ctx.set_text_baseline("middle");
        let score_y = label_y + 18.0;
        ctx.fill_text(&score_text, label_x, score_y).unwrap();
    }

    // Dessiner les données
    ctx.set_fill_style_str("rgba(211, 47, 47, 0.2)");
    ctx.set_stroke_style(&JsValue::from_str("#d32f2f"));
    ctx.set_line_width(2.0);
    ctx.begin_path();

    for (index, thematic) in thematics.iter().enumerate() {
        let score = scores.get(*thematic).unwrap_or(&0.0);
        let angle = (index as f64 * angle_step) - std::f64::consts::PI / 2.0;
        let r = (radius * score) / 100.0;
        let x = center_x + angle.cos() * r;
        let y = center_y + angle.sin() * r;

        if index == 0 {
            ctx.move_to(x, y);
        } else {
            ctx.line_to(x, y);
        }
    }

    ctx.close_path();
    ctx.fill();
    ctx.stroke();

    // Points sur les axes
    ctx.set_fill_style_str("#d32f2f");
    for (index, thematic) in thematics.iter().enumerate() {
        let score = scores.get(*thematic).unwrap_or(&0.0);
        let angle = (index as f64 * angle_step) - std::f64::consts::PI / 2.0;
        let r = (radius * score) / 100.0;
        let x = center_x + angle.cos() * r;
        let y = center_y + angle.sin() * r;

        ctx.begin_path();
        ctx.arc(x, y, 4.0, 0.0, std::f64::consts::PI * 2.0).unwrap();
        ctx.fill();
    }
}

