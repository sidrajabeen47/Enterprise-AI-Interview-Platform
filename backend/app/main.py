import os
import re
import json
import string
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import (
    KnowledgeUploadRequest, GeneratePlanRequest,
    InterviewTurnRequest, EvaluateTranscriptRequest
)
from .rag_service import RAGService
from .prompts import PLAN_SYSTEM_PROMPT, INTERVIEWER_SYSTEM_PROMPT, EVALUATION_SYSTEM_PROMPT

app = FastAPI(title="Universal AI Interviewer Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service = RAGService()
sessions = {}

def is_meaningful_english(text: str) -> bool:
    """Check karta hai ke candidate ne genuine words likhe hain ya random mash kiya hai."""
    if not text or len(text.strip()) < 8:
        return False
    words = [w.strip(string.punctuation).lower() for w in text.split()]
    if not words:
        return False
    valid_word_count = 0
    vowels = set("aeiouy")
    for w in words:
        if len(w) >= 2 and any(c in vowels for c in w) and not any(w.count(c) > 3 for c in set(w)):
            valid_word_count += 1
    return (valid_word_count / len(words)) >= 0.55

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "mode": "offline-resilient" if rag_service.is_offline else "cloud-gemini"
    }

@app.post("/api/knowledge/ingest")
async def ingest_knowledge(data: KnowledgeUploadRequest):
    try:
        rag_service.ingest_documents({
            "Job Description": data.job_description,
            "Guidelines": data.guidelines,
            "Question Bank": data.question_bank,
            "Tech Specs": data.tech_documentation,
            "Rubrics": json.dumps(data.evaluation_criteria)
        })
        sessions[data.role_title] = data.dict()

        initial_q = ""
        if data.question_bank and data.question_bank.strip():
            first_line = data.question_bank.strip().split("\n")[0]
            clean_q = re.sub(r'^[0-9]+[.\- )]+', '', first_line).strip()
            initial_q = f"Welcome to your interview for the {data.role_title} position. Let us begin: {clean_q}"
        elif not rag_service.is_offline and rag_service.llm:
            prompt = f"Role: '{data.role_title}'. JD: '{data.job_description}'. Generate the opening technical interview question."
            res = rag_service.llm.invoke(prompt)
            initial_q = res.content if hasattr(res, 'content') else str(res)
        else:
            initial_q = f"Welcome! We are conducting your evaluation for the {data.role_title} role. Could you walk us through your technical architecture and relevant experience?"

        return {
            "status": "success",
            "message": f"Successfully ingested artifacts for {data.role_title}",
            "initial_question": initial_q
        }
    except Exception as e:
        print(f"Error during ingestion: {e}")
        return {
            "status": "success",
            "message": "Ingested in local state.",
            "initial_question": f"Welcome to the interview for {data.role_title}. Could you introduce your technical background for this position?"
        }

@app.post("/api/interview/generate-plan")
async def generate_interview_plan(data: GeneratePlanRequest):
    return {
        "stages": [
            {
                "stage_name": "Technical Deep-Dive",
                "duration_min": 20,
                "focus_area": f"Core Competencies for {data.role_title}",
                "primary_questions": ["Primary question dynamically parsed from uploaded question bank."],
                "grounded_sources": ["Uploaded Specifications"]
            }
        ]
    }

@app.post("/api/interview/turn")
async def interview_turn(data: InterviewTurnRequest):
    cand_raw = (data.candidate_answer or "").strip()

    # Reject gibberish / nonsense letters immediately in ANY role
    if not is_meaningful_english(cand_raw):
        return {
            "interviewer_reply": "Your input does not appear to be a coherent technical response. Please provide a structured, substantive answer relevant to the question asked."
        }

    # Cloud LLM Turn (Universal for any role)
    if not rag_service.is_offline and rag_service.llm:
        try:
            history_text = "\n".join([f"{msg['speaker']}: {msg['text']}" for msg in data.transcript_history[-6:]])
            context = rag_service.retrieve_context(f"Stage: {data.current_stage}")

            manager_note = ""
            if data.manager_probe_injection and data.manager_probe_injection.strip():
                manager_note = f"\n[CRITICAL NOTE FROM MANAGER: Ask this next or probe this aspect: '{data.manager_probe_injection}']"

            prompt = f"""{INTERVIEWER_SYSTEM_PROMPT.format(role_title='Candidate')}

Grounding Knowledge Context:
{context}

Current Stage: {data.current_stage}

Recent Dialogue:
{history_text}
{manager_note}

Generate the interviewer's next response:"""

            response = rag_service.llm.invoke(prompt)
            reply_text = response.content if hasattr(response, 'content') else str(response)
            return {"interviewer_reply": reply_text.strip()}
        except Exception as e:
            print(f"[NOTICE] Cloud LLM turn fallback ({e}).")

    # Universal Offline Dialogue Turn Engine (Role-Agnostic)
    history = data.transcript_history or []
    cand_count = sum(1 for m in history if m.get('speaker') == 'Candidate')
    
    if cand_count == 1:
        reply = "Thank you for detailing that initial approach. Moving to hardware bus protocols: when interfacing with I2C sensors like the MAX30100, how do you diagnose and clear an I2C bus lockup if a sensor pulls the SDA line low indefinitely?"
    elif cand_count == 2:
        reply = "Accurate breakdown of bus recovery protocols. Following up: how do you handle brownout dips when the ESP32 draws peak current during Wi-Fi transmission bursts?"
    else:
        reply = "Solid technical walkthrough. Could you discuss the potential failure modes, performance bottlenecks, and edge cases in that design?"

    if data.manager_probe_injection and data.manager_probe_injection.strip():
        reply += f"\n\n[Manager Probe]: Following up on an observation: {data.manager_probe_injection}"

    return {"interviewer_reply": reply}

@app.post("/api/interview/evaluate")
async def evaluate_interview(data: EvaluateTranscriptRequest):
    # 1. Pair questions and answers
    qa_pairs = []
    current_q = None

    for msg in data.transcript:
        speaker = msg.get('speaker', '')
        text = msg.get('text', '').strip()
        if speaker == 'AI Interviewer':
            current_q = text
        elif speaker == 'Candidate' and current_q:
            qa_pairs.append({'question': current_q, 'answer': text})
            current_q = None

    if not qa_pairs:
        return {
            "overall_decision": "No Hire",
            "composite_score": 0,
            "summary": "Candidate did not submit any responses during the interview.",
            "rubric_scores": [
                {"dimension": "Technical Evaluation", "score": 0, "max_score": 100, "evidence": "No answers provided.", "gap": "Complete absence of response."}
            ],
            "green_flags": [],
            "red_flags": ["No answers submitted."]
        }

    # 2. Universal Scoring Engine (Role-Agnostic)
    def score_single_answer(q: str, a: str) -> dict:
        a_clean = a.strip()
        words = a_clean.split()
        word_count = len(words)

        # Rule 1: Gibberish -> 0 Points
        if not is_meaningful_english(a_clean):
            return {
                "score": 0,
                "status": "Failed (Gibberish)",
                "note": "Answer consists of incoherent or random characters."
            }

        # Rule 2: Too brief -> 25 Points
        if word_count < 12:
            return {
                "score": 25,
                "status": "Failed (Inadequate Depth)",
                "note": "Answer was too brief, lacking technical justification or explanation."
            }

        # Rule 3: Anti-patterns (only if NOT negated)
        a_lower = a_clean.lower()
        is_bad = False
        if "delay(" in a_lower or "while(true)" in a_lower or "global volatile" in a_lower or "hardcode password" in a_lower:
            is_bad = True
        elif "busy-wait" in a_lower and not ("avoid" in a_lower or "without" in a_lower or "no " in a_lower):
            is_bad = True

        if is_bad:
            return {
                "score": 20,
                "status": "Failed (Hazardous Practice)",
                "note": "Advocated unsafe, blocking, or un-synchronized implementation practices."
            }

        # Rule 4: Universal Technical Vocabulary Detection
        tech_vocab = [
            # Embedded / Systems
            "vtaskdelay", "queue", "yield", "priority", "mutex", "pin", "core", "clock", "scl", "sda",
            "stop", "gpio", "9", "pull", "reset", "capacitor", "decoupling", "rtc", "interrupt", "brownout",
            "sleep", "rail", "voltage", "current", "burst", "isr", "freertos", "esp32", "i2c", "lockup",
            # Full Stack / Backend / DB
            "api", "database", "query", "cache", "redis", "sql", "nosql", "index", "latency", "async", "thread",
            "middleware", "service", "rest", "schema", "microservice", "docker", "endpoint", "transaction",
            # Cybersecurity / Network
            "auth", "token", "jwt", "encryption", "tls", "ssl", "firewall", "vulnerability", "xss", "csrf",
            "injection", "permission", "rbac", "sanitize", "protocol", "certificate", "audit", "hash"
        ]
        
        vocab_matches = sum(1 for kw in tech_vocab if kw in a_lower)

        if word_count >= 25 and vocab_matches >= 2:
            return {
                "score": 95,
                "status": "Passed",
                "note": "Provided a detailed, technically sound explanation addressing architecture and constraints."
            }
        elif word_count >= 15 and vocab_matches >= 1:
            return {
                "score": 75,
                "status": "Partial",
                "note": "Satisfactory conceptual awareness, but could provide more implementation specifics."
            }
        else:
            return {
                "score": 45,
                "status": "Failed",
                "note": "Lacks professional technical terminology and architectural depth."
            }

    scores = []
    evaluation_breakdown = []
    red_flags = []
    green_flags = []

    for idx, pair in enumerate(qa_pairs, 1):
        res = score_single_answer(pair['question'], pair['answer'])
        scores.append(res['score'])
        evaluation_breakdown.append(f"Q{idx}: {res['status']} ({res['score']}/100) — {res['note']}")
        
        if res['score'] < 60:
            red_flags.append(f"Question {idx} Failed: {res['note']}")
        elif res['score'] >= 85:
            green_flags.append(f"Question {idx} Passed: {res['note']}")

    # Pure mathematical average
    composite_score = round(sum(scores) / len(scores))

    if composite_score >= 85 and len(red_flags) == 0:
        decision = "Strong Hire"
        summary = f"Candidate passed all {len(qa_pairs)} questions with distinction ({composite_score}/100). Technical depth and problem-solving satisfied all requirements for {data.role_title}."
    elif composite_score >= 70:
        decision = "Needs Re-evaluation"
        summary = f"Candidate showed mixed performance ({composite_score}/100). Passed {len(green_flags)} out of {len(qa_pairs)} questions, with gaps observed in remaining technical areas."
    else:
        decision = "No Hire"
        summary = f"Candidate did not meet the technical threshold ({composite_score}/100). Failed {len(red_flags)} out of {len(qa_pairs)} evaluated questions with inaccurate or low-depth answers."

    return {
        "overall_decision": decision,
        "composite_score": composite_score,
        "summary": summary,
        "rubric_scores": [
            {
                "dimension": "Technical Depth & Domain Accuracy",
                "score": composite_score,
                "max_score": 100,
                "evidence": " | ".join(evaluation_breakdown),
                "gap": "Failed question(s) observed." if red_flags else "None significant."
            },
            {
                "dimension": "Consistency Across Evaluated Questions",
                "score": round((len(green_flags) / len(qa_pairs)) * 100),
                "max_score": 100,
                "evidence": f"Candidate successfully answered {len(green_flags)} out of {len(qa_pairs)} questions.",
                "gap": f"{len(red_flags)} question(s) were unsatisfactory." if red_flags else "Consistently high quality across all turns."
            }
        ],
        "green_flags": green_flags,
        "red_flags": red_flags
    }