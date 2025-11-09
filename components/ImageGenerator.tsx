import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import { Spinner } from './Spinner';
import { SparklesIcon } from './icons/SparklesIcon';

const ImageGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<string>('1:1');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setImageUrl(null);

        try {
            const url = await generateImage(prompt, aspectRatio);
            setImageUrl(url);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <SparklesIcon className="w-6 h-6 mr-2 text-brand-blue-light" />
                Image Generator
            </h2>
            <p className="text-gray-400 mb-6">
                Describe the image you want to create. Be as specific as you can for the best results.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A photo of an astronaut riding a horse on Mars"
                    className="md:col-span-2 w-full h-24 p-4 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-blue-light focus:border-brand-blue-light transition duration-200 text-gray-200 resize-y"
                    disabled={isLoading}
                />
                <div>
                    <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                    <select
                        id="aspectRatio"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-blue-light focus:border-brand-blue-light transition duration-200 text-gray-200"
                        disabled={isLoading}
                    >
                        <option value="1:1">Square (1:1)</option>
                        <option value="16:9">Landscape (16:9)</option>
                        <option value="9:16">Portrait (9:16)</option>
                        <option value="4:3">Standard (4:3)</option>
                        <option value="3:4">Tall (3:4)</option>
                    </select>
                </div>
            </div>
            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="mt-4 w-full flex items-center justify-center bg-brand-blue-light hover:bg-brand-blue text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                {isLoading ? <Spinner /> : 'Generate Image'}
            </button>

            {error && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</div>}
            
            {isLoading && !imageUrl && (
                 <div className="mt-6 flex flex-col items-center justify-center text-gray-400">
                    <Spinner />
                    <p className="mt-2">Generating your image...</p>
                </div>
            )}

            {imageUrl && (
                <div className="mt-6">
                    <h3 className="text-xl font-bold mb-4">Generated Image</h3>
                    <img src={imageUrl} alt="Generated image" className="rounded-lg shadow-lg w-full object-contain" />
                </div>
            )}
        </div>
    );
};

export default ImageGenerator;
