"""
Tier 4 extractor: Playwright browser automation + LLM structured extraction.
Used for dynamic JS sites, complex navigation, and hard cases.

The LLM is constrained to fill slots in the Pydantic schema — it never decides
output shape. Rates are normalized at the schema level.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import anthropic
from pydantic import ValidationError

from ..models.tax_schema import StateTaxData, ExtractionResult, ConfidenceLevel


@dataclass
class PlaywrightSnapshot:
    url: str
    html: str
    screenshot_path: str | None = None
    navigation_steps: list[str] = field(default_factory=list)


def build_extraction_prompt(state_code: str, state_name: str, tax_year: int, content: str) -> str:
    return f"""Extract the {tax_year} individual income tax brackets and parameters for {state_name} ({state_code}).

Source content:
<content>
{content[:8000]}
</content>

Extract ONLY what is explicitly stated in the source. Do not invent or estimate values.
- Rates must be decimals (0.0475, not 4.75)
- Brackets must be monotonically increasing
- If you cannot confidently extract a field, return null for that field
- Use the notes field for any ambiguity or caveats

Return a JSON object matching the StateTaxData schema."""


def extract_with_llm(
    state_code: str,
    state_name: str,
    tax_year: int,
    content: str,
    source_url: str,
    extraction_tier: int = 4,
) -> ExtractionResult:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    try:
        response = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=4096,
            tools=[
                {
                    "name": "extract_tax_data",
                    "description": "Extract structured state income tax data",
                    "input_schema": StateTaxData.model_json_schema(),
                }
            ],
            tool_choice={"type": "tool", "name": "extract_tax_data"},
            messages=[
                {
                    "role": "user",
                    "content": build_extraction_prompt(state_code, state_name, tax_year, content),
                }
            ],
        )

        tool_use = next(
            (block for block in response.content if block.type == "tool_use"), None
        )
        if not tool_use:
            return ExtractionResult(
                success=False,
                confidence=ConfidenceLevel.LOW,
                extraction_tier=extraction_tier,
                source_url=source_url,
                failure_reason="No tool_use block in response",
            )

        raw = tool_use.input
        raw["state_code"] = state_code
        raw["state_name"] = state_name
        raw["tax_year"] = tax_year
        raw["extraction_tier"] = extraction_tier
        raw["source_url"] = source_url

        data = StateTaxData.model_validate(raw)
        return ExtractionResult(
            data=data,
            success=True,
            confidence=data.confidence,
            extraction_tier=extraction_tier,
            source_url=source_url,
        )

    except ValidationError as e:
        return ExtractionResult(
            success=False,
            confidence=ConfidenceLevel.LOW,
            extraction_tier=extraction_tier,
            source_url=source_url,
            failure_reason=f"Schema validation failed: {e}",
        )
    except Exception as e:
        return ExtractionResult(
            success=False,
            confidence=ConfidenceLevel.LOW,
            extraction_tier=extraction_tier,
            source_url=source_url,
            failure_reason=str(e),
        )
