import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { createChatSession, getGroundedChatResponse, getStandardChatResponse } from '../services/geminiService';
import { SendIcon } from './icons/SendIcon';
import { Spinner } from './Spinner';
import { SparklesIcon } from './icons/SparklesIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { Chat } from '@google/genai';
import { marked } from 'marked';

const ChatBot: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    const [useThinkingMode, setUseThinkingMode] = useState(false);
    const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    useEffect(() => {
        chatRef.current = createChatSession();
        setMessages([
            { id: Date.now(), text: "Hello! How can I help you today? You can enable Google Search or Maps for up-to-date information.", sender: 'bot' }
        ]);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser.");
            return;
        }
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            () => {
                setLocationError("Unable to retrieve your location. Please grant permission.");
                setUseMaps(false); // Disable if permission denied
            }
        );
    };

    const handleMapsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setUseMaps(checked);
        if (checked && !location) {
            handleGetLocation();
        }
    };
    
    const renderMessageContent = (text: string) => {
        const html = marked.parse(text) as string;
        return { __html: html };
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { id: Date.now(), text: input, sender: 'user' };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            if (useThinkingMode) {
                let botMessage: ChatMessage;
                 if (useSearch || useMaps) {
                    const response = await getGroundedChatResponse(currentInput, useSearch, useMaps, true, location ?? undefined);
                    botMessage = {
                        id: Date.now(),
                        text: response.text,
                        sender: 'bot',
                        sources: response.sources
                    };
                } else {
                    const responseText = await getStandardChatResponse(currentInput, updatedMessages);
                    botMessage = { id: Date.now(), text: responseText, sender: 'bot' };
                }
                setMessages(prev => [...prev, botMessage]);
            } else {
                if (useSearch || useMaps) {
                    const response = await getGroundedChatResponse(currentInput, useSearch, useMaps, false, location ?? undefined);
                    const botMessage: ChatMessage = {
                        id: Date.now(),
                        text: response.text,
                        sender: 'bot',
                        sources: response.sources
                    };
                    setMessages(prev => [...prev, botMessage]);
                } else {
                    if (!chatRef.current) return;
                    const botMessageId = Date.now() + 1;
                    setMessages(prev => [...prev, { id: botMessageId, text: '', sender: 'bot' }]);
                    const stream = await chatRef.current.sendMessageStream({ message: currentInput });
                    let botText = '';
                    for await (const chunk of stream) {
                        botText += chunk.text;
                        setMessages(prev =>
                            prev.map(msg =>
                                msg.id === botMessageId ? { ...msg, text: botText } : msg
                            )
                        );
                    }
                }
            }
        } catch (error) {
            console.error("Chatbot error:", error);
            const errorMessage = (error instanceof Error) ? error.message : 'Sorry, I encountered an error. Please try again.';
            setMessages(prev => [...prev, { id: Date.now(), text: errorMessage, sender: 'bot' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const placeholderText = 
        useSearch && useMaps ? "Ask with Search & Maps..." :
        useSearch ? "Ask with Google Search..." :
        useMaps ? "Ask with Google Maps..." :
        "Ask me anything...";

    return (
        <div className="flex flex-col h-[70vh] max-h-[70vh] bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10 max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                 <div className="flex items-center">
                    <SparklesIcon className="h-6 w-6 text-brand-blue-light mr-2" />
                    <h2 className="text-xl font-bold text-white">Gemini Chat</h2>
                 </div>
                 <div className="flex items-center space-x-2 md:space-x-4">
                    <label className="flex items-center text-sm text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={useThinkingMode} onChange={(e) => setUseThinkingMode(e.target.checked)} className="form-checkbox h-4 w-4 bg-gray-800 border-gray-600 text-brand-blue-light focus:ring-brand-blue-light rounded" />
                        <span className="ml-2">Thinking</span>
                    </label>
                    <label className="flex items-center text-sm text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={useSearch} onChange={(e) => setUseSearch(e.target.checked)} className="form-checkbox h-4 w-4 bg-gray-800 border-gray-600 text-brand-blue-light focus:ring-brand-blue-light rounded" />
                        <span className="ml-2">Search</span>
                    </label>
                     <label className="flex items-center text-sm text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={useMaps} onChange={handleMapsToggle} className="form-checkbox h-4 w-4 bg-gray-800 border-gray-600 text-brand-blue-light focus:ring-brand-blue-light rounded" />
                        <span className="ml-2">Maps</span>
                    </label>
                 </div>
            </div>
            {locationError && <div className="p-2 text-xs text-center text-yellow-400 bg-yellow-900/50">{locationError}</div>}
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-brand-blue-light text-white rounded-br-lg' : 'bg-gray-700 text-gray-200 rounded-bl-lg'}`}>
                           {msg.text || msg.sender === 'bot' ? (
                                <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={renderMessageContent(msg.text || '...')}></div>
                           ) : (
                               <span className="animate-pulse">...</span>
                           )}
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2 max-w-xs lg:max-w-md text-xs">
                                <h4 className="font-semibold text-gray-400 mb-1">Sources:</h4>
                                <ul className="space-y-1">
                                    {msg.sources.map((source, index) => (
                                        <li key={index} className="truncate">
                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-400 hover:underline">
                                                {source.type === 'maps' && <MapPinIcon className="w-4 h-4 mr-1 flex-shrink-0" />}
                                                <span className="truncate" title={source.title}>{source.title}</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
                 {isLoading && messages[messages.length - 1]?.sender === 'user' && (
                    <div className="flex justify-start">
                        <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-lg">
                           <div className="flex items-center space-x-2">
                            <Spinner/>
                            <span className="text-sm">Thinking...</span>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-white/10">
                <div className="flex items-center bg-gray-900 rounded-lg">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={placeholderText}
                        className="flex-1 bg-transparent p-3 text-gray-200 focus:outline-none"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="p-3 text-white disabled:text-gray-500 transition-colors"
                    >
                       {isLoading ? <Spinner /> : <SendIcon className="w-6 h-6" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatBot;