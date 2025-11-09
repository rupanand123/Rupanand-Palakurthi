import { GoogleGenAI, Type, Chat, Modality, Content } from "@google/genai";
import { AnalysisResult, GroundingSource, ChatMessage } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        classification: {
            type: Type.STRING,
            description: 'The classification of the news. Must be either "Real" or "Fake".'
        },
        confidence: {
            type: Type.NUMBER,
            description: 'A confidence score from 0 to 100 for the classification.'
        },
        explanation: {
            type: Type.STRING,
            description: 'A detailed analysis explaining the reasoning behind the classification. Mention linguistic cues, semantic context, and potential biases.'
        },
        keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'A list of 5-10 keywords or key phrases from the article text that were most influential in the classification decision. These keywords should be exact quotes from the text.'
        }
    },
    required: ['classification', 'confidence', 'explanation', 'keywords']
};

export const analyzeNewsArticle = async (articleText: string, useThinkingMode: boolean): Promise<AnalysisResult> => {
    try {
        const config: any = {
            systemInstruction: "You are an expert fact-checker and fake news detection system. Your task is to analyze news articles or social media posts and classify them as 'Real' or 'Fake'. Provide a confidence score, a detailed explanation for your reasoning, and a list of keywords from the article that led to your decision. You must only respond with a valid JSON object matching the provided schema, without any markdown formatting.",
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
        };

        if (useThinkingMode) {
            config.thinkingConfig = { thinkingBudget: 32768 };
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Analyze the following text and determine if it is real or fake news. Return your analysis in the specified JSON format. Article: "${articleText}"`,
            config,
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);

        // Basic validation
        if (typeof result.classification !== 'string' || typeof result.confidence !== 'number' || typeof result.explanation !== 'string' || !Array.isArray(result.keywords)) {
            throw new Error("Invalid response structure from API.");
        }
        
        return result as AnalysisResult;

    } catch (error) {
        console.error("Error analyzing news article:", error);
        throw new Error("Failed to get analysis from Gemini API. Please check the console for details.");
    }
};


export const createChatSession = (): Chat => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: 'You are a helpful and friendly chatbot. Answer user questions concisely and accurately.',
        },
    });
};

export const getStandardChatResponse = async (prompt: string, messages: ChatMessage[]): Promise<string> => {
    try {
        // History contains all messages, including the latest user prompt
        const history: Content[] = messages.slice(1).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: history,
            config: {
                systemInstruction: 'You are a helpful and friendly chatbot. Answer user questions concisely and accurately.',
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });
        
        return response.text;

    } catch (error) {
        console.error("Error getting standard chat response:", error);
        throw new Error("Failed to get response from Gemini API.");
    }
};

export const getGroundedChatResponse = async (
    prompt: string, 
    useSearch: boolean, 
    useMaps: boolean,
    useThinkingMode: boolean,
    location?: {latitude: number, longitude: number}
): Promise<{ text: string; sources: GroundingSource[] }> => {
    
    if (!useSearch && !useMaps) {
        throw new Error("Grounding must use either Search or Maps.");
    }
    
    const tools: any[] = [];
    if (useSearch) tools.push({ googleSearch: {} });
    if (useMaps) tools.push({ googleMaps: {} });

    let toolConfig: any = {};
    if (useMaps && location) {
        toolConfig.retrievalConfig = {
            latLng: {
                latitude: location.latitude,
                longitude: location.longitude,
            }
        };
    }

    const model = useThinkingMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const config: any = {
        tools,
        ...(Object.keys(toolConfig).length > 0 && { toolConfig }),
    };
    if (useThinkingMode) {
        config.thinkingConfig = { thinkingBudget: 32768 };
    }
    
    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config,
        });
        
        const sources: GroundingSource[] = [];
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        if (groundingChunks) {
            for (const chunk of groundingChunks) {
                if ('web' in chunk && chunk.web?.uri) {
                    sources.push({
                        uri: chunk.web.uri,
                        title: chunk.web.title || 'Web Search Result',
                        type: 'web',
                    });
                } else if ('maps' in chunk && chunk.maps?.uri) {
                    sources.push({
                        uri: chunk.maps.uri,
                        title: chunk.maps.title || 'Map Result',
                        type: 'maps',
                    });
                }
            }
        }

        return { text: response.text, sources };

    } catch (error) {
        console.error("Error getting grounded response:", error);
        throw new Error("Failed to get response from Gemini API.");
    }
};

export const generateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio,
            },
        });

        const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
        if (!imageBytes) {
            throw new Error("No image was generated in the response.");
        }
        return `data:image/jpeg;base64,${imageBytes}`;
    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate image.");
    }
};

export const generateVideo = async (
    prompt: string, 
    imageBase64: string,
    mimeType: string,
    aspectRatio: '16:9' | '9:16',
    onProgress: (message: string) => void
): Promise<string> => {
    
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API_KEY environment variable is not set for video generation.");
    }
    
    // Create a new instance right before the call to use the latest key
    const videoAI = new GoogleGenAI({ apiKey });

    try {
        onProgress("Starting video generation...");
        let operation = await videoAI.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            image: {
                imageBytes: imageBase64,
                mimeType,
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio
            }
        });

        onProgress("Processing video... This may take a few minutes.");
        let checks = 0;
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
            operation = await videoAI.operations.getVideosOperation({ operation });
            checks++;
            onProgress(`Still processing... (Check ${checks})`);
        }

        onProgress("Finalizing video...");
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        onProgress("Downloading video...");
        const videoResponse = await fetch(`${downloadLink}&key=${apiKey}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }
        
        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);
    } catch (error: any) {
        console.error("Error generating video:", error);
        if (error.message?.includes("Requested entity was not found")) {
            throw new Error("API Key not found or invalid. Please select a valid API key and try again.");
        }
        throw new Error(error.message || "Failed to generate video.");
    }
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: imageBase64,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image was generated in the response.");

    } catch (error) {
        console.error("Error editing image:", error);
        throw new Error("Failed to edit image.");
    }
};

export const transcribeAudio = async (audioBase64: string, audioMimeType: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: audioBase64,
                            mimeType: audioMimeType,
                        },
                    },
                    {
                        text: "Transcribe the following audio recording. Provide only the text from the audio.",
                    },
                ],
            },
            config: {
                 systemInstruction: "You are an expert audio transcription service. Your only task is to accurately transcribe the audio provided by the user. Do not add any extra commentary, greetings, or explanations. Only output the transcribed text.",
            }
        });

        return response.text;
    } catch (error) {
        console.error("Error transcribing audio:", error);
        throw new Error("Failed to transcribe audio.");
    }
};