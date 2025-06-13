# Voice Guardian API Server

Express server providing transcription services using HuggingFace Inference API.

## Setup

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your HuggingFace API token:
   ```
   HF_API_TOKEN=your_token_here
   ```

3. **Get HuggingFace API Token:**
   - Go to [HuggingFace Settings](https://huggingface.co/settings/tokens)
   - Create a new token with "Read" permissions
   - Copy the token to your `.env` file

## Development

```bash
npm run dev
```

Server will start on http://localhost:3001

## Production

```bash
npm run build
npm start
```

## API Endpoints

### POST /api/transcribe

Transcribe an audio file using Whisper models.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Audio file in `audio` field
- Query params:
  - `model` (optional): Model to use (`whisper-tiny`, `whisper-base`, `whisper-small`, `whisper-medium`, `whisper-large`)

**Example:**
```bash
curl -X POST \
  -F "audio=@recording.wav" \
  "http://localhost:3001/api/transcribe?model=whisper-base"
```

**Response:**
```json
{
  "success": true,
  "transcription": {
    "text": "Hello, this is a test transcription."
  },
  "metadata": {
    "model": "openai/whisper-base.en",
    "originalFilename": "recording.wav",
    "fileSize": 1234567,
    "mimetype": "audio/wav",
    "processedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### GET /api/models

List available Whisper models.

**Response:**
```json
{
  "models": [
    {
      "key": "whisper-tiny",
      "name": "openai/whisper-tiny.en",
      "description": "Fastest, least accurate (39 MB)"
    }
  ]
}
```

### GET /health

Health check endpoint.

## Supported Audio Formats

- WAV
- MP3
- M4A
- OGG
- FLAC
- WebM

## Error Handling

The API returns appropriate HTTP status codes:

- `400` - Bad request (no file uploaded)
- `401` - Authentication failed (invalid HF token)
- `408` - Request timeout
- `413` - File too large (>100MB)
- `429` - Rate limit exceeded
- `503` - Model loading (retry after 20 seconds)
- `500` - Internal server error

## CORS Configuration

Configure allowed origins in `.env`:
```
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend-domain.com
```

## Model Selection

Choose the right model for your needs:

- **whisper-tiny**: Fastest, good for real-time applications
- **whisper-base**: Good balance of speed and accuracy
- **whisper-small**: Better accuracy for important transcriptions
- **whisper-medium**: High accuracy for professional use
- **whisper-large**: Best accuracy for critical applications

## Rate Limits

HuggingFace Inference API has rate limits:
- Free tier: Limited requests per hour
- Pro tier: Higher limits available

## Security Notes

- Store HF_API_TOKEN securely
- Configure CORS properly for production
- Consider implementing authentication for production use
- Monitor file upload sizes and processing times