import React, { useState } from 'react';
import { AnalysisResult, GroundingSource } from '../types';
import { analyzeNewsArticle, getGroundedChatResponse } from '../services/geminiService';
import { Spinner } from './Spinner';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';

const ResultDisplay: React.FC<{ 
    result: AnalysisResult;
    onGetContext: () => void;
    isContextLoading: boolean;
    contextResult: { text: string; sources: GroundingSource[] } | null;
    contextError: string | null;
}> = ({ result, onGetContext, isContextLoading, contextResult, contextError }) => {
    const isReal = result.classification === 'Real';
    const confidenceColor = isReal ? 'bg-green-500' : 'bg-red-500';

    const highlightKeywords = (text: string, keywords: string[]) => {
        if (!keywords || keywords.length === 0) {
            return text;
        }
        const escapedKeywords = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
        
        const parts = text.split(regex);

        return parts.map((part, index) => 
            keywords.some(kw => kw.toLowerCase() === part.toLowerCase())
                ? <strong key={index} className="text-yellow-300 bg-yellow-800/50 px-1 rounded">{part}</strong>
                : part
        );
    };

    return (
        <div className="mt-6 p-6 bg-white/5 rounded-lg border border-white/10 animate-fade-in">
            <h3 className="text-xl font-bold mb-4">Analysis Result</h3>
            <div className="flex items-center space-x-4 mb-4">
                <div className={`flex items-center space-x-2 px-4 py-2 rounded-full text-white font-semibold ${isReal ? 'bg-green-600' : 'bg-red-600'}`}>
                    {isReal ? <CheckCircleIcon className="w-6 h-6" /> : <XCircleIcon className="w-6 h-6" />}
                    <span>{result.classification}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4">
                    <div 
                        className={`h-4 rounded-full ${confidenceColor} transition-all duration-500`} 
                        style={{ width: `${result.confidence}%` }}
                    ></div>
                </div>
                <span className="font-mono text-lg">{result.confidence}%</span>
            </div>
            <div>
                <h4 className="font-semibold text-lg mb-2">Explanation</h4>
                <p className="text-gray-300 whitespace-pre-wrap">{highlightKeywords(result.explanation, result.keywords)}</p>
            </div>
            
            <div className="mt-6 border-t border-gray-700 pt-4">
                <h4 className="font-semibold text-lg mb-2">Further Research</h4>
                <p className="text-sm text-gray-400 mb-4">Get up-to-date context on the key topics from this article using Google Search.</p>
                <button
                    onClick={onGetContext}
                    disabled={isContextLoading}
                    className="flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:bg-gray-800 disabled:cursor-not-allowed"
                >
                    {isContextLoading ? <Spinner /> : 'Get Web Context'}
                </button>

                {contextError && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{contextError}</div>}

                {contextResult && (
                    <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in">
                        <p className="text-gray-300 whitespace-pre-wrap mb-4">{contextResult.text}</p>
                        {contextResult.sources && contextResult.sources.length > 0 && (
                            <div>
                                <h5 className="font-semibold text-gray-400 mb-1 text-sm">Sources:</h5>
                                <ul className="space-y-1 text-sm">
                                    {contextResult.sources.map((source, index) => (
                                        <li key={index} className="truncate">
                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-400 hover:underline">
                                                <span className="truncate" title={source.title}>{source.title}</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


const NewsAnalyzer: React.FC = () => {
    const [articleText, setArticleText] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
    const [useThinkingMode, setUseThinkingMode] = useState<boolean>(false);

    const [isContextLoading, setIsContextLoading] = useState<boolean>(false);
    const [contextResult, setContextResult] = useState<{ text: string; sources: GroundingSource[] } | null>(null);
    const [contextError, setContextError] = useState<string | null>(null);


    const handleAnalyze = async () => {
        if (!articleText.trim()) {
            setError('Please enter some text to analyze.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        setContextResult(null);
        setContextError(null);
        try {
            const analysisResult = await analyzeNewsArticle(articleText, useThinkingMode);
            setResult(analysisResult);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGetContext = async () => {
        if (!result) return;
        setIsContextLoading(true);
        setContextResult(null);
        setContextError(null);
        try {
            const query = `Provide a brief, neutral summary of the key facts related to the following topics: ${result.keywords.slice(0, 5).join(', ')}.`;
            const contextData = await getGroundedChatResponse(query, true, false, false);
            setContextResult(contextData);
        } catch (e: any) {
            setContextError(e.message || 'An unknown error occurred.');
        } finally {
            setIsContextLoading(false);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto">
            <div className="p-6 bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10">
                <h2 className="text-2xl font-bold mb-4 text-white">News & Post Analyzer</h2>
                <p className="text-gray-400 mb-6">
                    Paste the text of a news article or social media post below to check for potential misinformation.
                </p>
                <textarea
                    value={articleText}
                    onChange={(e) => setArticleText(e.target.value)}
                    placeholder="Enter text here..."
                    className="w-full h-48 p-4 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-blue-light focus:border-brand-blue-light transition duration-200 text-gray-200 resize-y"
                    disabled={isLoading}
                />
                <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="mt-4 w-full flex items-center justify-center bg-brand-blue-light hover:bg-brand-blue text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Spinner /> : 'Analyze Text'}
                </button>

                <div className="mt-4">
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-gray-400 hover:text-white transition-colors">
                        {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                    </button>
                    {showAdvanced && (
                        <div className="mt-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in space-y-4">
                            <h4 className="font-semibold text-white mb-2">Analysis Configuration</h4>
                             <label className="flex items-center space-x-3 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={useThinkingMode} onChange={() => setUseThinkingMode(!useThinkingMode)} className="form-checkbox h-4 w-4 bg-gray-800 border-gray-600 text-brand-blue-light focus:ring-brand-blue-light rounded" />
                                <div>
                                    <span className="font-medium">Enable Thinking Mode</span>
                                    <p className="text-xs text-gray-500">Uses gemini-2.5-pro for deeper analysis of complex topics. May take longer.</p>
                                </div>
                            </label>
                             <div>
                                <h5 className="font-semibold text-white mb-2 text-sm">Other Options</h5>
                                <p className="text-sm text-gray-500">
                                    (Note: Additional options below are for demonstration and are not yet connected to the analysis API.)
                                </p>
                                <div className="mt-3 space-y-3">
                                    <div>
                                        <label htmlFor="confidence" className="block text-sm font-medium text-gray-300 mb-1">
                                            Confidence Threshold
                                        </label>
                                        <input type="range" id="confidence" name="confidence" min="50" max="100" defaultValue="75" className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300">
                                            Linguistic Cues to Focus On
                                        </label>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                                            {['Emotional Language', 'Source Citing', 'Bias Detection', 'Factuality'].map(cue => (
                                                <label key={cue} className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                                                    <input type="checkbox" className="form-checkbox h-4 w-4 bg-gray-800 border-gray-600 text-brand-blue-light focus:ring-brand-blue-light rounded" />
                                                    <span>{cue}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {error && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</div>}
                
                {result && <ResultDisplay 
                    result={result} 
                    onGetContext={handleGetContext}
                    isContextLoading={isContextLoading}
                    contextResult={contextResult}
                    contextError={contextError}
                />}

            </div>
        </div>
    );
};

export default NewsAnalyzer;