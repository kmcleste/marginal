"""
Tier 3 extractor: OCR + structured extraction for PDF bracket tables.
Uses pdfplumber for text-based PDFs; falls back to pytesseract for scanned docs.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class OcrResult:
    source_path: str
    text: str
    tier: int = 3
    success: bool = True
    error: str | None = None


def extract_pdf_text(pdf_path: str) -> OcrResult:
    try:
        import pdfplumber  # type: ignore

        with pdfplumber.open(pdf_path) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        return OcrResult(source_path=pdf_path, text="\n".join(pages))
    except Exception as e:
        return OcrResult(source_path=pdf_path, text="", success=False, error=str(e))


def extract_pdf_ocr(pdf_path: str) -> OcrResult:
    """Fallback: rasterize pages and OCR with pytesseract."""
    try:
        import pytesseract  # type: ignore
        from pdf2image import convert_from_path  # type: ignore

        pages = convert_from_path(pdf_path, dpi=300)
        text = "\n".join(pytesseract.image_to_string(page) for page in pages)
        return OcrResult(source_path=pdf_path, text=text)
    except Exception as e:
        return OcrResult(source_path=pdf_path, text="", success=False, error=str(e))


def extract_pdf(pdf_path: str) -> OcrResult:
    result = extract_pdf_text(pdf_path)
    if not result.success or len(result.text.strip()) < 100:
        return extract_pdf_ocr(pdf_path)
    return result
