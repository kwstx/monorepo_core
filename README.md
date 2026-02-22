# PolicySchemaTranslator

A module for converting natural language policies into structured, machine-readable objects for multi-agent governance systems.

## Overview

The `PolicySchemaTranslator` bridge the gap between human-written regulations and executable agent instructions. It ensures that every policy includes:
- **Metadata**: Scope, Domain, and Effective Date.
- **Logical Conditions**: Parameter-based evaluations (e.g., `trust_score > 0.7`).
- **Action Triggers**: Immediate actions for agents on activation or violation.
- **Exception Handling**: Defined scenarios where policies are bypassed or modified.
- **Actionable Instructions**: Step-by-step guidance for autonomous agents.

## Project Structure

- `src/models/policy_schema.py`: Pydantic models for the structured policy.
- `src/repository/policy_repository.py`: Versioned, queryable storage for policies and templates.
- `src/api/main.py`: PolicyAPI implementation for external systems and agents.
- `src/translator/core.py`: Main translator class and serialization logic.
- `src/translator/prompt_templates.py`: Instructions for LLMs to perform the translation.
- `tests/test_policy_api.py`: Verification tests for the PolicyAPI.
- `tests/test_translation.py`: Example usage and verification flow.
- `tests/test_repository.py`: Tests for the storage and versioning layer.

## Usage

### Translation

```python
from src.translator import PolicySchemaTranslator
from src.models import PolicyDomain, PolicyScope

translator = PolicySchemaTranslator()

# 1. Translate NL to Structured Object
# structured_policy = translator.translate("Your natural language policy here")

# 2. Export to JSON for Agent consumption
# json_payload = translator.export_as_json(structured_policy)
```

### Repository & Templates

```python
from src.repository import PolicyRepository

repo = PolicyRepository("sqlite:///my_policies.db")

# Save a policy
repo.save_policy(structured_policy)

# Browse templates by industry
templates = repo.list_policies(industry="Healthcare", is_template=True)

# Clone and adapt a template
new_policy = repo.clone_template(
    template_id="BASE-AUTH",
    new_policy_id="CLIENT-X-AUTH",
    updates={"industry": "Finance", "functional_area": "Account Management"}
)
```

### Template Extensibility & Validation

The `TemplateExtensibilityModule` allows for advanced template management, including legal validation and live integration.

```python
from src.extensibility import TemplateExtensibilityModule
from src.repository import PolicyRepository
from src.live_update import LiveUpdateEngine

repo = PolicyRepository()
engine = LiveUpdateEngine()
extensibility = TemplateExtensibilityModule(repo, engine)

# 1. Create a new template with validation
# extensibility.create_template(my_new_template)

# 2. Customize a template and automatically update live engine
# extensibility.customize_template("BASE-TMPL", "NEW-POL", {"industry": "Web3"})
```

The module ensures that all new templates and customized policies meet internal standards and are immediately propagated to active workflows through the `LiveUpdateEngine`.

## Requirements

- Python 3.10+
- `pydantic>=2.0.0`
- `sqlalchemy`
