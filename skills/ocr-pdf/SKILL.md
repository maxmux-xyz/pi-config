---
name: ocr-pdf
description: OCR scanned PDFs to extract text using macOS Vision framework. Use when a PDF contains scanned images instead of selectable text — i.e. when pdftotext returns empty output. Supports French and English. Requires macOS and poppler (pdfimages).
---

# OCR Scanned PDFs

## When to Use

Use this skill when:
- A PDF returns no text from `pdftotext`
- `pdfimages -list <file.pdf>` shows the PDF is image-based
- The user asks to read/extract text from a scanned document

## Usage

```bash
swift scripts/ocr-pdf.swift <input.pdf> [--lang fr,en] [--out output.txt]
```

- **Default languages**: French, English (`fr,en`)
- **`--lang`**: Comma-separated language codes (e.g. `en`, `fr,en,de`)
- **`--out`**: Write to file instead of stdout

The script extracts page images with `pdfimages`, then runs macOS Vision OCR on each page. Output is separated by `--- Page N ---` headers.

## Requirements

- macOS (uses native Vision framework via Swift)
- `pdfimages` from poppler (`brew install poppler`)

## Detection

To check if a PDF needs OCR before running:

```bash
# If this returns empty, the PDF is scanned and needs OCR
pdftotext input.pdf -
```
