# Code Generator Agent - Generates code using AI
import json
import requests
from .base import BaseAgent, GROQ_BASE_URL, MODEL


class CodeGeneratorAgent(BaseAgent):
    """Agent that generates code using AI"""
    
    def __init__(self, api_key=None):
        super().__init__(api_key)
        self.name = "Code Generator"
        self.description = "Generates clean, production-ready code from natural language prompts"
        
        self.system_prompt = """You are an expert code generator that creates well-structured, production-ready projects.

CRITICAL OUTPUT FORMAT RULES:
1. For multi-file projects, prefix EACH file with a comment marker showing its path:
   <!-- path/to/file.ext -->
   Use HTML comment markers <!-- --> for ALL file markers regardless of language.

2. Choose the MOST APPROPRIATE industry-standard project structure for the technology requested.
   Adapt folder layout to the language/framework. Examples:
   - React/JS: public/, src/components/, src/hooks/, src/styles/, src/utils/, tests/
   - Python/Flask: app/, app/routes/, app/models/, app/templates/, app/static/, tests/
   - Node/Express: src/routes/, src/middleware/, src/models/, src/controllers/, tests/
   - HTML/CSS/JS (no framework): css/ (base.css, components.css, layout.css), js/ (app.js, ui.js, storage.js, utils.js), index.html

3. MANDATORY FILE COUNT for apps/projects/systems: Generate a MINIMUM of 10 separate files. NEVER put everything in one monolithic file.
   Break features into individual files — one responsibility per file:
   - ONE file per UI component or page section
   - ONE file per data model or service
   - Separate CSS files for base styles, layout, and component styles
   - Separate JS files for app logic, UI interactions, data/storage, and utilities
   - Test files for core modules
   - README.md with project overview and setup instructions
   - Config/dependency file (package.json, requirements.txt, etc.)

4. SINGLE-FILE OUTPUT — use this when the request is for:
   - A single function, algorithm, or short program (e.g. "write a C program to...", "write a Python function for...", "implement binary search", "factorial using recursion")
   - A code snippet, utility, or script
   - Any request that does NOT ask for an app, project, website, system, dashboard, or platform
   For single-file output: just output the raw code with NO <!-- --> markers.

5. Do NOT wrap code in markdown code blocks (``` or ```python or ```js etc.). Output raw code only.
6. Each file should be complete, functional, and well-documented with comments.
7. Include proper error handling, input validation, and edge case handling.
8. Write clean, idiomatic code following the conventions of the chosen language/framework.
9. COMMENTS: Use ONLY brief single-line comments where necessary. NEVER add docstrings (no triple-quote blocks), NEVER add a comment to every line, NEVER add section header comments. Code should be self-documenting. Example of good commenting: one short comment per logical block, like "# Sort the array" — not a comment on every single line.
10. NEVER include markdown language tags like ```python, ```javascript, ```html etc. in the output. Output ONLY raw source code."""
        
    def generate(self, prompt):
        """Non-streaming code generation"""
        result = self.call_api(self.system_prompt, prompt)
        if result:
            result = self._strip_markdown_fences(result)
            return result
        return self._mock_generate(prompt)
    
    @staticmethod
    def _strip_markdown_fences(code):
        """Remove markdown code fences like ```python, ```js, etc."""
        import re
        lines = code.split('\n')
        # Strip opening fence (```python, ```javascript, ```html, ```, etc.)
        if lines and re.match(r'^```\w*$', lines[0].strip()):
            lines = lines[1:]
        # Strip closing fence
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        return '\n'.join(lines)
    
    def generate_stream(self, prompt):
        """Streaming code generation - yields chunks"""
        try:
            response = requests.post(
                GROQ_BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 8000,
                    "stream": True
                },
                stream=True,
                timeout=120
            )
            
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            data = line[6:]
                            if data == '[DONE]':
                                break
                            try:
                                chunk = json.loads(data)
                                if 'choices' in chunk and len(chunk['choices']) > 0:
                                    delta = chunk['choices'][0].get('delta', {})
                                    content = delta.get('content', '')
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
            else:
                print(f"Stream Error: {response.status_code}")
                for chunk in self._mock_stream(prompt):
                    yield chunk
        except Exception as e:
            print(f"Stream Error: {e}")
            for chunk in self._mock_stream(prompt):
                yield chunk
    
    def _mock_stream(self, prompt):
        """Mock streaming for fallback"""
        code = self._mock_generate(prompt)
        chunk_size = 20
        for i in range(0, len(code), chunk_size):
            yield code[i:i+chunk_size]
    
    def _mock_generate(self, prompt):
        """Fallback mock generation"""
        return f'''def solution(param1, param2):
    """Generated function for: {prompt[:30]}..."""
    result = param1 + param2
    return result

if __name__ == "__main__":
    print(solution(10, 20))'''
