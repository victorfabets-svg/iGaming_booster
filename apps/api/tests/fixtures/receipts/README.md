# Receipt Fixtures Directory

This directory contains test fixtures for OCR receipt validation.

## Format

Each fixture consists of:
- `<name>.png` or `<name>.jpg` - The receipt image
- `<name>.expected.json` - Expected OCR results

## Expected JSON Schema

```json
{
  "amount": 100.00,
  "payment_identifier": "TXN123456",
  "currency": "USD",
  "expected_house_slug": "bet365"
}
```

## Notes

- Fixtures should be placed here by external agents
- The harness skips if no fixtures are present
- Supported formats: PNG, JPG, JPEG