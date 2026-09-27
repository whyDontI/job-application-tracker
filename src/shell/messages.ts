import type { ExtractionResult } from "../core/extraction.js";

export interface ExtractThreadRequest {
  type: "EXTRACT_THREAD";
  threadText: string;
}

export type ExtractThreadResponse =
  | { ok: true; result: ExtractionResult }
  | { ok: false; error: string };

export type ExtensionMessage = ExtractThreadRequest;
