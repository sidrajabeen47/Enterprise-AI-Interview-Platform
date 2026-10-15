from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class KnowledgeUploadRequest(BaseModel):
    role_title: str
    job_description: str
    guidelines: str
    question_bank: str
    tech_documentation: str
    evaluation_criteria: List[Dict[str, str]]

class GeneratePlanRequest(BaseModel):
    role_title: str
    duration_minutes: int = 45

class InterviewTurnRequest(BaseModel):
    session_id: str
    current_stage: str
    transcript_history: List[Dict[str, str]]
    candidate_answer: Optional[str] = None
    manager_probe_injection: Optional[str] = None

class EvaluateTranscriptRequest(BaseModel):
    role_title: str
    transcript: List[Dict[str, str]]
    evaluation_criteria: List[Dict[str, str]]