use yew::prelude::*;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub on_start: Callback<()>,
}

#[function_component]
pub fn WelcomeScreen(props: &Props) -> Html {
    let on_click = {
        let callback = props.on_start.clone();
        Callback::from(move |_| callback.emit(()))
    };

    html! {
        <div class="screen active welcome-screen">
            <div class="container welcome-container">
                <div class="logo">
                    <img src="hub612-logo.webp" alt="HUB612" />
                </div>
                <h2>{"Mini Audit Start to Scale"}</h2>
                <p class="intro">
                    {"Testez votre startup en 5 minutes !"}
                    <br />
                    {"Répondez à quelques questions pour évaluer votre maturité sur les thématiques clés du programme Start to Scale."}
                </p>
                <div class="welcome-image">
                    <img src="laundry-1834_256.gif" alt="Mini audit Start to Scale" />
                </div>
                <button onclick={on_click} class="btn btn-primary">
                    {"Commencer l'audit"}
                </button>
                <footer class="welcome-footer">
                    <p class="footer-text">
                        {"Made with "}
                        <span class="heart">{"❤️"}</span>
                        {" by Hub612"}
                    </p>
                    <a
                        href="https://www.websitecarbon.com/website/mini-audit-start-to-scale-vercel-app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="carbon-badge"
                        title="Website Carbon Calculator"
                    >
                        <span class="carbon-text">{"🌱 "}</span>
                        <span class="carbon-label">{"Carbon footprint"}</span>
                    </a>
                </footer>
            </div>
        </div>
    }
}
