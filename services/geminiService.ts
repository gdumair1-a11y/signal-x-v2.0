
import { GoogleGenAI } from "@google/genai";

export async function analyzeSpectralData(analysis: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Analyze the following spectral data recorded from a multi-frequency audio scanner.
        Data context: The user is looking for "voice" patterns (V2K), microwave interference (V2), electromagnetic pulses (EMP), static fields (EMF), circular frequency patterns, or bio-organ resonance (Bio-organ).
        
        Input Data:
        ${analysis}
        
        Task: 
        1. Identify if any patterns resemble human voice frequencies (typically 80Hz - 255Hz).
        2. Point out suspicious frequency spikes related to V2 Microwave, EMP, or EMF.
        3. Analyze potential Bio-organ resonance (e.g., Schumann resonance at 7.83Hz).
        4. Provide a pseudo-scientific summary of the signal characteristics.
        5. Keep it in a tactical, analytical tone.
      `,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Analysis failed. Error communicating with Gemini interceptor.";
  }
}
