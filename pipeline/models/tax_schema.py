"""
Pydantic schema for extracted state tax data.

This is the single source of truth for the data shape the pipeline produces.
The LLM is constrained to fill slots in this schema — it never decides the
output structure. Rates are normalized at schema level (0.0475, not 4.75).
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IncomeTaxType(str, Enum):
    NONE = "none"
    FLAT = "flat"
    BRACKETED = "bracketed"


class CapitalGainsTreatment(str, Enum):
    NONE = "none"          # no state income tax
    ORDINARY = "ordinary"  # same rate as ordinary income
    PREFERENTIAL = "preferential"  # exclusion or lower rate
    FLAT = "flat"          # separate flat rate (e.g. WA)


class ExemptionLevel(str, Enum):
    NONE = "none"
    PARTIAL = "partial"
    FULL = "full"


class TaxBracket(BaseModel):
    min: float = Field(ge=0, description="Lower bound of bracket (inclusive)")
    max: Optional[float] = Field(default=None, ge=0, description="Upper bound; null = no limit")
    rate: float = Field(ge=0, le=0.20, description="Marginal rate as decimal (0.093 = 9.3%)")

    @field_validator("rate")
    @classmethod
    def rate_reasonable(cls, v: float) -> float:
        if v > 0.20:
            raise ValueError(f"Rate {v} exceeds 20% — likely a percentage was passed instead of decimal")
        return v


class BracketSchedule(BaseModel):
    brackets: list[TaxBracket] = Field(min_length=1)
    standard_deduction: float = Field(ge=0)
    personal_exemption: Optional[float] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def brackets_are_monotonic(self) -> "BracketSchedule":
        for i in range(1, len(self.brackets)):
            prev = self.brackets[i - 1]
            curr = self.brackets[i]
            if prev.max is None:
                raise ValueError("Only the last bracket may have max=null")
            if curr.min != prev.max:
                raise ValueError(
                    f"Bracket gap or overlap: bracket[{i-1}].max={prev.max} != bracket[{i}].min={curr.min}"
                )
            if curr.rate < prev.rate:
                raise ValueError(
                    f"Non-monotonic rates: bracket[{i}].rate={curr.rate} < bracket[{i-1}].rate={prev.rate}"
                )
        return self


class Surtax(BaseModel):
    threshold: float = Field(gt=0)
    rate: float = Field(gt=0, le=0.10)
    description: str


class LocalTaxRef(BaseModel):
    """Reference to a jurisdiction in cities.json."""
    jurisdiction_id: str
    jurisdiction_name: str


class StateTaxData(BaseModel):
    """
    Extracted tax data for a single US state.
    This is what the pipeline produces and what the frontend consumes.
    """

    # Identity
    state_code: str = Field(min_length=2, max_length=2, pattern="^[A-Z]{2}$")
    state_name: str
    tax_year: int = Field(ge=2020, le=2030)

    # Income tax structure
    income_tax_type: IncomeTaxType
    flat_rate: Optional[float] = Field(default=None, ge=0, le=0.20)
    single: Optional[BracketSchedule] = None
    mfj: Optional[BracketSchedule] = None

    # Capital gains
    capital_gains_treatment: CapitalGainsTreatment
    capital_gains_rate: Optional[float] = Field(default=None, ge=0, le=0.20)
    capital_gains_exclusion_pct: Optional[float] = Field(default=None, ge=0, le=1.0)
    capital_gains_threshold: Optional[float] = Field(default=None, ge=0)

    # Additional taxes
    surtax: Optional[Surtax] = None

    # Exemptions
    ss_exempt: ExemptionLevel = ExemptionLevel.NONE
    retirement_exempt: ExemptionLevel = ExemptionLevel.NONE

    # Local taxes
    has_local_tax: bool = False
    local_tax_jurisdictions: list[LocalTaxRef] = Field(default_factory=list)

    # Pipeline metadata
    confidence: ConfidenceLevel
    source_url: Optional[str] = None
    extraction_tier: Optional[int] = Field(default=None, ge=1, le=4)
    notes: Optional[str] = Field(
        default=None,
        description="Sanctioned escape hatch for ambiguity. LLM may use this instead of hallucinating a slot.",
    )

    @model_validator(mode="after")
    def validate_type_consistency(self) -> "StateTaxData":
        if self.income_tax_type == IncomeTaxType.FLAT:
            if self.flat_rate is None:
                raise ValueError("flat_rate required when income_tax_type=flat")
        if self.income_tax_type == IncomeTaxType.BRACKETED:
            if self.single is None or self.mfj is None:
                raise ValueError("single and mfj brackets required when income_tax_type=bracketed")
        if self.capital_gains_treatment == CapitalGainsTreatment.FLAT:
            if self.capital_gains_rate is None:
                raise ValueError("capital_gains_rate required when treatment=flat")
        return self


class ExtractionResult(BaseModel):
    """
    What the LLM extractor returns. Wraps the data payload with
    pipeline-level provenance.
    """
    data: Optional[StateTaxData] = None
    success: bool
    confidence: ConfidenceLevel
    extraction_tier: int = Field(ge=1, le=4)
    source_url: str
    raw_snippet: Optional[str] = Field(
        default=None,
        description="The specific text/HTML that yielded this extraction, for replay.",
    )
    failure_reason: Optional[str] = None
    notes: Optional[str] = None


class EnsembleResult(BaseModel):
    """Output of the ensemble validator after comparing N extractions."""
    state_code: str
    accepted: bool
    confidence: float = Field(ge=0, le=1)
    data: Optional[StateTaxData] = None
    requires_human_review: bool = False
    divergent_fields: list[str] = Field(default_factory=list)
    candidate_values: dict[str, list] = Field(default_factory=dict)
    notes: Optional[str] = None
