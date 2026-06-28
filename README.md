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

To get started, ensure you have Docker installed and run the following command:

```bash
docker compose up --build
```

The application will be accessible at `http://localhost:3000`. You can upload your XES event logs and start analyzing the automation potential of process activities.