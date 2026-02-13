# Uber Code Generator - AI Agents Package
# This package contains all the AI-powered agents for code generation and analysis

from .base import BaseAgent, call_groq_api, GROQ_API_KEY, GROQ_BASE_URL, MODEL
from .code_generator import CodeGeneratorAgent
from .validator import ValidationAgent
from .testing import TestingAgent
from .security import SecurityAgent
from .planner import ProjectPlannerAgent

__all__ = [
    'BaseAgent',
    'CodeGeneratorAgent',
    'ValidationAgent', 
    'TestingAgent',
    'SecurityAgent',
    'ProjectPlannerAgent',
    'call_groq_api',
    'GROQ_API_KEY',
    'GROQ_BASE_URL',
    'MODEL'
]

# Agent descriptions for display
AGENT_INFO = {
    'planner': {
        'name': 'Project Planner',
        'icon': '📋',
        'description': 'Classifies project scope and plans multi-file structure'
    },
    'code_generator': {
        'name': 'Code Generator',
        'icon': '🚀',
        'description': 'Generates clean, production-ready code from natural language'
    },
    'validator': {
        'name': 'Validation Agent',
        'icon': '✅',
        'description': 'Validates code style, syntax, and best practices'
    },
    'testing': {
        'name': 'Testing Agent', 
        'icon': '🧪',
        'description': 'Analyzes testability and adds error handling'
    },
    'security': {
        'name': 'Security Agent',
        'icon': '🛡️',
        'description': 'Scans for vulnerabilities and applies security fixes'
    }
}
