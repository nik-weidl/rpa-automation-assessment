# Evaluating Agentic Large Language Models for Assessing RPA Automation Potential from XES Event Logs

*Master Thesis Niklas Weidl Ulm University 2026*

## Goal

The objective of this thesis is to design, implement, and evaluate a prototype software tool for assessing the RPA automation potential of process activities derived from XES event logs using agentic Large Language Models (LLMs).

The tool will combine Process Mining techniques with structured activity profiles and multiple assessment strategies. It will support the identification of automation candidates, provide explainable assessments, and visualize the results through an interactive user interface.

The thesis investigates and compares different assessment approaches:

- Rule-based assessment
- Single-shot LLM assessment
- Hybrid assessment combining rules and LLM reasoning
- Agentic LLM assessment with self-critique and metric retrieval

The tool will provide the following functionality:

- Import and analysis of XES event logs
- Extraction of structured activity profiles
- Calculation of rule-based automation scores
- Execution of LLM-based automation assessments
- Support for agentic assessment workflows
- Visualization of process structures and activity relationships
- Identification and ranking of automation candidates
- Presentation of explanations, risks, and missing information
- Comparison of multiple LLMs through OpenRouter

## Quickstart

1. **Create `.env` File**:
   Create a `.env` file in the project root with the following content and insert your OpenRouter API key:

   ```env
   DATABASE_URL="postgresql://rpa_user:rpa_password@localhost:5432/rpa_assessment?schema=public"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"

   OPENROUTER_API_KEY="your_openrouter_api_key_here"
   ```

2. **Start Application**:
   Ensure Docker is running, then execute:

   ```bash
   docker compose up --build
   ```

The application will be accessible at `http://localhost:3000`. Database migrations run automatically on startup.