import React, { useState, useEffect, useRef } from 'react';
import { generateVideo } from '../services/geminiService';
import { Spinner } from './Spinner';
import { SparklesIcon } from './icons/SparklesIcon';
import { VideoIcon } from './icons/VideoIcon';
import { ImageIcon } from './icons/ImageIcon';

// Fix: Resolve conflicting global type for `window.aistudio`.
// The original inline type for `aistudio` conflicted with an existing global
// declaration. The fix is to augment the existing global `AIStudio` interface,
// which `window.aistudio` is typed as. This merges the properties and
// resolves the type conflict.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error("Failed to read blob as base64 string."));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setIsKeySelected(hasKey);
            } else {
                // Fallback for environments where aistudio is not available
                setIsKeySelected(!!process.env.API_KEY);
            }
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            // Assume success and let the API call fail if the key is invalid.
            setIsKeySelected(true);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleGenerate = async () => {
        if (!imageFile) {
            setError('Please upload an image.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setVideoUrl(null);

        try {
            const imageBase64 = await blobToBase64(imageFile);
            const url = await generateVideo(
                prompt,
                imageBase64,
                imageFile.type,
                aspectRatio,
                (message) => setLoadingMessage(message)
            );
            setVideoUrl(url);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
            // If API key is invalid, prompt user to select again
            if (e.message?.includes("API Key not found")) {
                setIsKeySelected(false);
            }
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    if (isKeySelected === null) {
        return (
            <div className="p-6 bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10 max-w-4xl mx-auto text-center">
                <Spinner />
                <p className="mt-2 text-gray-300">Checking API Key status...</p>
            </div>
        )
    }

    if (!isKeySelected) {
         return (
            <div className="p-6 bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10 max-w-4xl mx-auto text-center">
                 <h2 className="text-2xl font-bold mb-4 text-white">API Key Required for Video Generation</h2>
                 <p className="text-gray-400 mb-6">
                    Video generation with Veo requires a dedicated API key with billing enabled. Please select your key to continue.
                 </p>
                 <button onClick={handleSelectKey} className="bg-brand-blue-light hover:bg-brand-blue text-white font-bold py-3 px-6 rounded-lg transition">
                     Select API Key
                 </button>
                 <p className="mt-4 text-xs text-gray-500">
                    For more information on billing, visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-blue-light">ai.google.dev/gemini-api/docs/billing</a>.
                 </p>
            </div>
         )
    }

    return (
        <div className="p-6 bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <VideoIcon className="w-6 h-6 mr-2 text-brand-blue-light" />
                Video Generator
            </h2>
            <p className="text-gray-400 mb-6">
                Upload a starting image, provide a prompt, and generate a short video.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">1. Upload Starting Image</label>
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-brand-blue-light transition"
                    >
                        <div className="space-y-1 text-center">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="mx-auto h-48 w-auto object-contain rounded-md" />
                            ) : (
                                <>
                                    <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                                    <div className="flex text-sm text-gray-400">
                                        <p className="pl-1">Click to upload an image</p>
                                    </div>
                                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                                </>
                            )}
                        </div>
                    </div>
                    <input ref={fileInputRef} id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                </div>
                <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">2. Describe the action (optional)</label>
                    <textarea
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., The astronaut slowly floats away"
                        className="w-full h-24 p-4 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-blue-light"
                        disabled={isLoading}
                    />
                     <label htmlFor="aspectRatioVideo" className="block text-sm font-medium text-gray-300 mb-2 mt-4">3. Select Aspect Ratio</label>
                    <select
                        id="aspectRatioVideo"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-blue-light"
                        disabled={isLoading}
                    >
                        <option value="16:9">Landscape (16:9)</option>
                        <option value="9:16">Portrait (9:16)</option>
                    </select>
                </div>
            </div>
            
            <button
                onClick={handleGenerate}
                disabled={isLoading || !imageFile}
                className="mt-6 w-full flex items-center justify-center bg-brand-blue-light hover:bg-brand-blue text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                {isLoading ? <Spinner /> : 'Generate Video'}
            </button>

            {error && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</div>}
            
            {isLoading && (
                 <div className="mt-6 flex flex-col items-center justify-center text-gray-400">
                    <Spinner />
                    <p className="mt-2 font-semibold">{loadingMessage}</p>
                    <p className="text-sm text-gray-500">Video generation can take several minutes. Please be patient.</p>
                </div>
            )}

            {videoUrl && (
                <div className="mt-6">
                    <h3 className="text-xl font-bold mb-4">Generated Video</h3>
                    <video src={videoUrl} controls autoPlay loop className="rounded-lg shadow-lg w-full" />
                </div>
            )}
        </div>
    );
};

export default VideoGenerator;