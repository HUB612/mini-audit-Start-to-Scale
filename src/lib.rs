mod app;
mod components;
mod models;
mod survey;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
    yew::Renderer::<app::App>::new().render();
}
