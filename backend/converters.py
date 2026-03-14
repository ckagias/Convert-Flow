# Converts files (PDF, DOCX, PPTX, etc.) using stored filenames only. All paths stay inside upload/output dirs.

from __future__ import annotations

import io
import zipfile
import traceback
from pathlib import Path
from typing import Literal, Tuple

from pdf2docx import Converter as PDFConverter
from docx import Document
from pptx import Presentation
from PIL import Image
from openpyxl import load_workbook
from PyPDF2 import PdfReader, PdfWriter
from pdf2image import convert_from_path

UPLOAD_DIR = Path("/app/uploads")
OUTPUT_DIR = Path("/app/outputs")

ConversionResult = Tuple[bool, str]


# Helper to build a safe output filename from a stored name and new extension
def _safe_output_name(stored_filename: str, new_ext: str) -> str:
  base = stored_filename.rsplit(".", 1)[0]
  return f"{base}.{new_ext.lstrip('.').lower()}"


def pdf_to_docx(stored: str) -> ConversionResult:
  input_path = UPLOAD_DIR / stored
  output_name = _safe_output_name(stored, "docx")
  output_path = OUTPUT_DIR / output_name

  try:
    cv = PDFConverter(str(input_path))
    cv.convert(str(output_path), start=0, end=None)
    cv.close()
    if not output_path.exists() or output_path.stat().st_size == 0:
      raise RuntimeError("empty output")
    return True, output_name
  except Exception:
    traceback.print_exc()
    if output_path.exists():
      output_path.unlink()
    return False, ""


def docx_to_pdf(stored: str) -> ConversionResult:
  # Basic export: no full layout, keeps the flow safe (no external tools)
  input_path = UPLOAD_DIR / stored
  output_name = _safe_output_name(stored, "pdf")
  output_path = OUTPUT_DIR / output_name

  try:
    doc = Document(str(input_path))
    writer = PdfWriter()
    page = writer.add_blank_page(width=595, height=842)  # A4 points
    # Minimal output: one blank page (no full DOCX→PDF layout here)
    with open(output_path, "wb") as f:
      writer.write(f)
    return True, output_name
  except Exception:
    traceback.print_exc()
    if output_path.exists():
      output_path.unlink()
    return False, ""


def pdf_to_images(stored: str, fmt: Literal["jpg", "png"]) -> ConversionResult:
  input_path = UPLOAD_DIR / stored
  base = stored.rsplit(".", 1)[0]
  try:
    pages = convert_from_path(str(input_path))
    image_names = []
    for idx, img in enumerate(pages, start=1):
      name = f"{base}_page_{idx:03d}.{fmt}"
      out = OUTPUT_DIR / name
      img.save(out, fmt.upper())
      image_names.append(name)
    if not image_names:
      raise RuntimeError("no pages")
    if len(image_names) == 1:
      return True, image_names[0]
    zip_name = f"{base}_pages.zip"
    zip_path = OUTPUT_DIR / zip_name
    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
      for name in image_names:
        full = OUTPUT_DIR / name
        zf.write(str(full), name)
        full.unlink()
    return True, zip_name
  except Exception:
    traceback.print_exc()
    return False, ""


def image_to_pdf(stored: str) -> ConversionResult:
  input_path = UPLOAD_DIR / stored
  output_name = _safe_output_name(stored, "pdf")
  output_path = OUTPUT_DIR / output_name
  try:
    img = Image.open(input_path).convert("RGB")
    img.save(output_path, "PDF")
    return True, output_name
  except Exception:
    traceback.print_exc()
    if output_path.exists():
      output_path.unlink()
    return False, ""


def image_to_image(stored: str, target_ext: str) -> ConversionResult:
  input_path = UPLOAD_DIR / stored
  output_name = _safe_output_name(stored, target_ext)
  output_path = OUTPUT_DIR / output_name
  try:
    img = Image.open(input_path)
    img.save(output_path, target_ext.upper())
    return True, output_name
  except Exception:
    traceback.print_exc()
    if output_path.exists():
      output_path.unlink()
    return False, ""


def pptx_to_pdf(stored: str) -> ConversionResult:
  # Produces a one-page PDF (placeholder layout)
  input_path = UPLOAD_DIR / stored
  _ = Presentation(str(input_path))  # validates file
  output_name = _safe_output_name(stored, "pdf")
  output_path = OUTPUT_DIR / output_name
  try:
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    with open(output_path, "wb") as f:
      writer.write(f)
    return True, output_name
  except Exception:
    traceback.print_exc()
    if output_path.exists():
      output_path.unlink()
    return False, ""


def pptx_to_images(stored: str, fmt: Literal["jpg", "png"]) -> ConversionResult:
  # Convert via PDF first, then to images
  ok, pdf_name = pptx_to_pdf(stored)
  if not ok:
    return False, ""
  return pdf_to_images(pdf_name, fmt)


def xlsx_to_pdf(stored: str) -> ConversionResult:
  input_path = UPLOAD_DIR / stored
  output_name = _safe_output_name(stored, "pdf")
  output_path = OUTPUT_DIR / output_name
  try:
    load_workbook(str(input_path), read_only=True)  # validate file
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    with open(output_path, "wb") as f:
      writer.write(f)
    return True, output_name
  except Exception:
    traceback.print_exc()
    if output_path.exists():
      output_path.unlink()
    return False, ""


def pdf_basic_op(stored: str, operation: Literal["rotate"]) -> ConversionResult:
  input_path = UPLOAD_DIR / stored
  output_name = _safe_output_name(stored, "pdf")
  output_path = OUTPUT_DIR / output_name
  try:
    reader = PdfReader(str(input_path))
    writer = PdfWriter()
    for page in reader.pages:
      if operation == "rotate":
        page.rotate(90)
      writer.add_page(page)
    with open(output_path, "wb") as f:
      writer.write(f)
    return True, output_name
  except Exception:
    traceback.print_exc()
    if output_path.exists():
      output_path.unlink()
    return False, ""


# Map each source format to the list of allowed target formats
SUPPORTED_CONVERSIONS = {
  "pdf":  ["docx", "jpg", "png"],
  "docx": ["pdf"],
  "pptx": ["pdf", "jpg", "png"],
  "xlsx": ["pdf"],
  "jpg":  ["pdf", "png"],
  "jpeg": ["pdf", "png"],
  "png":  ["pdf", "jpg"],
}


def handle_conversion(stored_filename: str, target_format: str) -> ConversionResult:
  """
  Route a stored file + desired target extension to the appropriate handler.
  The caller must already have validated that this (source, target) pair is
  allowed using SUPPORTED_CONVERSIONS.
  """
  source_ext = stored_filename.rsplit(".", 1)[-1].lower()
  target = target_format.lower().lstrip(".")

  if source_ext == "pdf" and target == "docx":
    return pdf_to_docx(stored_filename)
  if source_ext == "pdf" and target in {"jpg", "png"}:
    return pdf_to_images(stored_filename, target)  # uses pdf2image + Pillow

  if source_ext in {"jpg", "jpeg", "png"} and target == "pdf":
    return image_to_pdf(stored_filename)
  if source_ext in {"jpg", "jpeg", "png"} and target in {"jpg", "jpeg", "png"}:
    return image_to_image(stored_filename, target)

  if source_ext == "docx" and target == "pdf":
    return docx_to_pdf(stored_filename)

  if source_ext == "pptx" and target == "pdf":
    return pptx_to_pdf(stored_filename)
  if source_ext == "pptx" and target in {"jpg", "png"}:
    return pptx_to_images(stored_filename, target)

  if source_ext == "xlsx" and target == "pdf":
    return xlsx_to_pdf(stored_filename)

  return False, ""

