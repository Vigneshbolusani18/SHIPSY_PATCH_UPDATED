# AI Console API

## POST /api/ai/answer

Answers natural language questions. Optionally uses DB results.

### Request Body

```json
{
  "message": "Show shipments from Mumbai in transit",
  "useDb": true
}
```

### Response

```json
{
  "ok": true,
  "reply": "Found 7 shipments..."
}
```

## POST /api/ai/chat

Lightweight chat helper.

### Request Body

```json
{
  "message": "Hello"
}
```

### Response

```json
{
  "ok": true,
  "reply": "Hi! How can I help?"
}
```

## GET /api/ai/test

Health check endpoint.

### Response

**Status:** 200 OK

```json
{
  "ok": true,
  "reply": "..."
}
```

## POST /api/ai/test

Send minimal prompt through `askGeminiWithRetry`.

### Request Body

```json
{
  "message": "Ping from CLI"
}
```