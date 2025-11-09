export interface AnalysisResult {
    classification: 'Real' | 'Fake';
    confidence: number;
    explanation: string;
    keywords: string[];
}

export interface GroundingSource {
    uri: string;
    title: string;
    type: 'web' | 'maps';
}

export interface ChatMessage {
    id: number;
    text: string;
    sender: 'user' | 'bot';
    sources?: GroundingSource[];
}