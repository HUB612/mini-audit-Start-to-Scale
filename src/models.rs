use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Question {
    pub id: Uuid,
    pub text: String,
    pub description: Option<String>,
    pub thematic: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Answer {
    Oui,
    Non,
    JeNeSaisPas,
}

impl Answer {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "oui" => Some(Answer::Oui),
            "non" => Some(Answer::Non),
            "je-ne-sais-pas" => Some(Answer::JeNeSaisPas),
            _ => None,
        }
    }

    pub fn to_score(&self) -> f64 {
        match self {
            Answer::Oui => 100.0,
            Answer::Non => 0.0,
            Answer::JeNeSaisPas => 50.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct QuestionData {
    pub question: Question,
    pub thematic: String,
    pub answer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SurveyResults {
    pub scores: std::collections::HashMap<String, f64>,
    pub total_answered: usize,
    pub total_questions: usize,
}

#[derive(Debug, Deserialize)]
pub struct ThematicQuestions {
    pub thematic: String,
    pub questions: Vec<QuestionYaml>,
}

#[derive(Debug, Deserialize)]
pub struct QuestionYaml {
    pub text: String,
    pub description: Option<String>,
}
