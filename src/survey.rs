use crate::models::*;
use serde_yaml;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Clone)]
pub struct Survey {
    questions: Vec<Question>,
    answers: std::rc::Rc<std::cell::RefCell<HashMap<Uuid, Answer>>>,
}

impl Survey {
    pub fn new() -> Self {
        let mut questions = Vec::new();
        
        // Charger les questions depuis les fichiers YAML
        let thematics = vec![
            ("business-model", include_str!("../questions/business-model.yaml")),
            ("produit", include_str!("../questions/produit.yaml")),
            ("go-to-market", include_str!("../questions/go-to-market.yaml")),
            ("organisation", include_str!("../questions/organisation.yaml")),
            ("financement", include_str!("../questions/financement.yaml")),
        ];

        for (_, yaml_content) in thematics {
            if let Ok(thematic_data) = serde_yaml::from_str::<ThematicQuestions>(yaml_content) {
                let thematic_name = thematic_data.thematic.clone();
                for q_yaml in thematic_data.questions {
                    let question = Question {
                        id: Uuid::new_v4(),
                        text: q_yaml.text,
                        description: q_yaml.description,
                        thematic: thematic_name.clone(),
                    };
                    questions.push(question);
                }
            }
        }

        Self {
            questions,
            answers: std::rc::Rc::new(std::cell::RefCell::new(HashMap::new())),
        }
    }

    pub fn total_questions(&self) -> usize {
        self.questions.len()
    }

    pub fn get_question(&self, index: usize) -> QuestionData {
        if let Some(question) = self.questions.get(index) {
            let answer = self.answers.borrow().get(&question.id).map(|a| match a {
                Answer::Oui => "oui".to_string(),
                Answer::Non => "non".to_string(),
                Answer::JeNeSaisPas => "je-ne-sais-pas".to_string(),
            });

            QuestionData {
                question: question.clone(),
                thematic: question.thematic.clone(),
                answer,
            }
        } else {
            // Question par défaut si l'index est invalide
            QuestionData {
                question: Question {
                    id: Uuid::new_v4(),
                    text: "Question introuvable".to_string(),
                    description: None,
                    thematic: "".to_string(),
                },
                thematic: "".to_string(),
                answer: None,
            }
        }
    }

    pub fn answer_question(&self, index: usize, answer_str: &str) {
        if let Some(question) = self.questions.get(index) {
            if let Some(answer) = Answer::from_str(answer_str) {
                self.answers.borrow_mut().insert(question.id, answer);
            }
        }
    }

    pub fn get_results(&self) -> SurveyResults {
        let mut scores_by_thematic: HashMap<String, Vec<f64>> = HashMap::new();
        let answers = self.answers.borrow();

        // Calculer les scores par thématique
        for question in &self.questions {
            let score = if let Some(answer) = answers.get(&question.id) {
                answer.to_score()
            } else {
                0.0
            };

            scores_by_thematic
                .entry(question.thematic.clone())
                .or_insert_with(Vec::new)
                .push(score);
        }

        // Calculer la moyenne par thématique
        let mut scores = HashMap::new();
        for (thematic, score_list) in scores_by_thematic {
            let average = if score_list.is_empty() {
                0.0
            } else {
                score_list.iter().sum::<f64>() / score_list.len() as f64
            };
            scores.insert(thematic, average);
        }

        SurveyResults {
            scores,
            total_answered: answers.len(),
            total_questions: self.questions.len(),
        }
    }
}

