import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob as GenAIAPIBlob } from '@google/genai';
import { Spinner } from './Spinner';
import { AudioWaveIcon } from './icons/AudioWaveIcon';
import { StopIcon } from './icons/StopIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';

// --- Audio Helper Functions from Gemini Docs ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): GenAIAPIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Component ---
const LiveChat: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Click Start to begin conversation.');
    const [error, setError] = useState<string | null>(null);
    const [transcriptionHistory, setTranscriptionHistory] = useState<{ speaker: 'user' | 'model', text: string }[]>([]);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRefs = useRef<{ input: AudioContext | null, output: AudioContext | null, processor: ScriptProcessorNode | null, source: MediaStreamAudioSourceNode | null }>({ input: null, output: null, processor: null, source: null });
    const outputPlayback = useRef<{ nextStartTime: number, sources: Set<AudioBufferSourceNode> }>({ nextStartTime: 0, sources: new Set() });
    const transcriptionRefs = useRef<{ currentInput: string, currentOutput: string }>({ currentInput: '', currentOutput: '' });
    const aiRef = useRef<GoogleGenAI | null>(null);

    const cleanup = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRefs.current.processor) {
            audioContextRefs.current.processor.disconnect();
            audioContextRefs.current.processor = null;
        }
        if (audioContextRefs.current.source) {
            audioContextRefs.current.source.disconnect();
            audioContextRefs.current.source = null;
        }
        if (audioContextRefs.current.input) {
            audioContextRefs.current.input.close();
            audioContextRefs.current.input = null;
        }
         if (audioContextRefs.current.output) {
            audioContextRefs.current.output.close();
            audioContextRefs.current.output = null;
        }
        outputPlayback.current.sources.forEach(source => source.stop());
        outputPlayback.current.sources.clear();
        setIsSessionActive(false);
        setStatusMessage('Session ended. Click Start to begin again.');
    }, []);

    const handleStop = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        cleanup();
    }, [cleanup]);

    const handleStart = async () => {
        setError(null);
        setTranscriptionHistory([]);
        setStatusMessage('Requesting microphone access...');
        
        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            setError('Microphone access denied. Please allow microphone access in your browser settings.');
            setStatusMessage('Microphone access denied.');
            return;
        }

        if (!aiRef.current) {
            aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        }
        
        // Fix: Cast window to `any` to access `webkitAudioContext` for older browser compatibility
        // without causing a TypeScript error, as it's a non-standard property.
        audioContextRefs.current.input = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRefs.current.output = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        outputPlayback.current.nextStartTime = 0;
        
        setIsSessionActive(true);
        setStatusMessage('Connecting to Gemini...');

        sessionPromiseRef.current = aiRef.current.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                systemInstruction: "You are a helpful conversational AI. You do not have access to real-time information from the web. If the user asks about current events, news, or topics requiring up-to-date data, you must state that you cannot access live information and politely recommend they use the 'Chat' tab with the 'Search' option enabled for the best results.",
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    setStatusMessage('Connected. Start speaking...');
                    audioContextRefs.current.source = audioContextRefs.current.input!.createMediaStreamSource(streamRef.current!);
                    const processor = audioContextRefs.current.input!.createScriptProcessor(4096, 1, 1);
                    audioContextRefs.current.processor = processor;

                    processor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    audioContextRefs.current.source.connect(processor);
                    processor.connect(audioContextRefs.current.input!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Handle Transcription
                    if (message.serverContent?.inputTranscription) {
                        transcriptionRefs.current.currentInput += message.serverContent.inputTranscription.text;
                    }
                     if (message.serverContent?.outputTranscription) {
                        transcriptionRefs.current.currentOutput += message.serverContent.outputTranscription.text;
                    }
                    if (message.serverContent?.turnComplete) {
                        const fullInput = transcriptionRefs.current.currentInput;
                        const fullOutput = transcriptionRefs.current.currentOutput;
                        if(fullInput.trim()) setTranscriptionHistory(prev => [...prev, { speaker: 'user', text: fullInput }]);
                        if(fullOutput.trim()) setTranscriptionHistory(prev => [...prev, { speaker: 'model', text: fullOutput }]);
                        transcriptionRefs.current.currentInput = '';
                        transcriptionRefs.current.currentOutput = '';
                    }

                    // Handle Audio Output
                    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        const outputCtx = audioContextRefs.current.output!;
                        outputPlayback.current.nextStartTime = Math.max(outputPlayback.current.nextStartTime, outputCtx.currentTime);
                        
                        const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                        const source = outputCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputCtx.destination);
                        
                        const currentSources = outputPlayback.current.sources;
                        source.addEventListener('ended', () => currentSources.delete(source));
                        source.start(outputPlayback.current.nextStartTime);
                        outputPlayback.current.nextStartTime += audioBuffer.duration;
                        currentSources.add(source);
                    }

                    if (message.serverContent?.interrupted) {
                        outputPlayback.current.sources.forEach(s => s.stop());
                        outputPlayback.current.sources.clear();
                        outputPlayback.current.nextStartTime = 0;
                    }
                },
                onerror: (e: ErrorEvent) => {
                    setError(`Connection error: ${e.message}`);
                    handleStop();
                },
                onclose: (e: CloseEvent) => {
                    handleStop();
                },
            },
        });
    };
    
    useEffect(() => {
        return () => handleStop();
    }, [handleStop]);

    return (
        <div className="p-6 bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <AudioWaveIcon className="w-6 h-6 mr-2 text-brand-blue-light" />
                Live Conversation
            </h2>
            <p className="text-gray-400 mb-2">
                Talk to Gemini in real-time. Click Start to activate your microphone and begin the conversation.
            </p>
             <p className="text-xs text-gray-500 mb-6">
                Note: This mode is for conversation and does not have access to live web data. For current events, please use the 'Chat' tab with 'Search' enabled.
            </p>

            <div className="flex flex-col items-center">
                <div className="flex items-center space-x-4 mb-4">
                    {!isSessionActive ? (
                         <button onClick={handleStart} className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition">
                            <MicrophoneIcon className="w-6 h-6 mr-2" />
                            Start
                        </button>
                    ) : (
                         <button onClick={handleStop} className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition">
                            <StopIcon className="w-6 h-6 mr-2" />
                            Stop
                        </button>
                    )}
                </div>
                 <div className="flex items-center text-gray-300">
                    {isSessionActive && <Spinner />}
                    <p className="ml-2">{statusMessage}</p>
                </div>
            </div>

            <div className="mt-6 min-h-[300px] max-h-[300px] overflow-y-auto p-4 bg-gray-900 border border-gray-700 rounded-lg space-y-3">
                {transcriptionHistory.length === 0 && <p className="text-gray-500">Transcription will appear here...</p>}
                {transcriptionHistory.map((entry, index) => (
                    <div key={index} className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-md px-3 py-2 rounded-lg ${entry.speaker === 'user' ? 'bg-brand-blue-light text-white' : 'bg-gray-700 text-gray-200'}`}>
                           <span className="font-bold capitalize">{entry.speaker}: </span> {entry.text}
                        </div>
                    </div>
                ))}
            </div>
            
            {error && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</div>}
        </div>
    );
};

export default LiveChat;