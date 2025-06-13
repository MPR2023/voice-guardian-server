export interface TranscriptionRequest {
  model?: string;
}

export interface TranscriptionResponse {
  success: boolean;
  transcription: {
    text: string;
    chunks?: Array<{
      timestamp: [number, number];
      text: string;
    }>;
  };
  metadata: {
    model: string;
    originalFilename: string;
    fileSize: number;
    mimetype: string;
    processedAt: string;
  };
}

export interface ErrorResponse {
  error: string;
  details: string;
  status?: number;
  retryAfter?: number;
}

export interface ModelInfo {
  key: string;
  name: string;
  description: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}