import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';
import { Spinner } from './Spinner';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { StopIcon } from './icons/StopIcon';

const Transcriber: React.FC = () => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [transcription, setTranscription] = useState<string>('');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleStartRecording = async () => {
        setError(null);
        setTranscription('');
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                audioChunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };

                mediaRecorderRef.current.onstop = async () => {
                    setIsLoading(true);
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        try {
                            const resultStr = reader.result as string;
                            if (!resultStr || !resultStr.includes(',')) {
                                throw new Error("Failed to read audio data correctly.");
                            }
                            const base64Audio = resultStr.split(',')[1];
                            const result = await transcribeAudio(base64Audio, 'audio/webm');
                            setTranscription(result);
                        } catch (e: any) {
                             setError(e.message || 'An unknown error occurred during transcription.');
                        } finally {
                            setIsLoading(false);
                        }
                    };
                    
                    // Stop all tracks to release the microphone
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch (err) {
                setError('Microphone access was denied. Please allow access in your browser settings.');
                console.error("Error accessing microphone:", err);
            }
        } else {
            setError('Audio recording is not supported by your browser.');
        }
    };
    
    const handleStopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
         <div className="p-6 bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <MicrophoneIcon className="w-6 h-6 mr-2 text-brand-blue-light" />
                Audio Transcriber
            </h2>
            <p className="text-gray-400 mb-6">
                Click the record button to start capturing audio from your microphone. Click stop when you're done.
            </p>

            <div className="flex justify-center items-center space-x-4">
                <button
                    onClick={handleStartRecording}
                    disabled={isRecording || isLoading}
                    className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <MicrophoneIcon className="w-6 h-6 mr-2" />
                    Record
                </button>
                <button
                    onClick={handleStopRecording}
                    disabled={!isRecording || isLoading}
                    className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <StopIcon className="w-6 h-6 mr-2" />
                    Stop
                </button>
            </div>
            
            <div className="mt-6 min-h-[200px] p-4 bg-gray-900 border border-gray-700 rounded-lg">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center text-gray-400 h-full">
                        <Spinner />
                        <p className="mt-2">Transcribing audio...</p>
                    </div>
                ) : (
                    <>
                        <h3 className="font-semibold text-lg mb-2">Transcription:</h3>
                        <p className="text-gray-200 whitespace-pre-wrap">
                           {transcription || <span className="text-gray-500">Your transcribed text will appear here...</span>}
                        </p>
                    </>
                )}
            </div>

            {error && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</div>}
        </div>
    );
};

export default Transcriber;