
import { GoogleGenAI } from "@google/genai";
import { Resolution } from "../types";

export const editImageWithGemini = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  resolution: Resolution = '1K'
): Promise<string> => {
  // Use the most up-to-date API key for every request
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  // Select model based on requested resolution
  const modelName = resolution === '1K' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
  
  const systemPrompt = `You are a professional image editing AI. Your task is to REMOVE the objects or regions described by the user. 
  When removing an object, realistically fill in the background using context-aware inpainting to match lighting, textures, and perspective. 
  The user wants to remove: "${prompt}". 
  Please output ONLY the final edited image. Ensure the output matches the requested high quality standard.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1], // Remove prefix if present
              mimeType: mimeType,
            },
          },
          {
            text: systemPrompt,
          },
        ],
      },
      config: {
        // Only Pro models support explicit imageSize config
        ...(modelName === 'gemini-3-pro-image-preview' ? {
          imageConfig: {
            imageSize: resolution
          }
        } : {})
      }
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("Invalid response format from AI engine.");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data part was returned from the model.");
  } catch (error: any) {
    console.error("Gemini Image Edit Error:", error);
    
    const errorStr = JSON.stringify(error);
    
    // Check for specific Gemini API error patterns
    if (error.message?.includes("entity was not found") || errorStr.includes("Requested entity was not found")) {
      throw new Error("STUDIO_KEY_ERROR");
    }
    
    if (error.status === "RESOURCE_EXHAUSTED" || errorStr.includes("429") || errorStr.includes("quota")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    
    throw error;
  }
};
