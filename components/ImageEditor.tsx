import React, { useState, useRef } from 'react';
import { editImage } from '../services/geminiService';
import { Spinner } from './Spinner';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { ImageIcon } from './icons/ImageIcon';

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

const ImageEditor: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setEditedImageUrl(null); // Clear previous result
        }
    };

    const handleGenerate = async () => {
        if (!imageFile) {
            setError('Please upload an image to edit.');
            return;
        }
        if (!prompt.trim()) {
            setError('Please enter an editing prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setEditedImageUrl(null);

        try {
            const imageBase64 = await blobToBase64(imageFile);
            const url = await editImage(prompt, imageBase64, imageFile.type);
            setEditedImageUrl(url);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 bg-brand-gray-dark rounded-xl shadow-2xl border border-white/10 max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <PencilSquareIcon className="w-6 h-6 mr-2 text-brand-blue-light" />
                Image Editor
            </h2>
            <p className="text-gray-400 mb-6">
                Upload an image and describe the changes you'd like to make.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                     <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex justify-center w-full px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-brand-blue-light transition"
                    >
                        <div className="space-y-1 text-center">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Upload Preview" className="mx-auto h-48 max-h-48 w-auto object-contain rounded-md" />
                            ) : (
                                <>
                                    <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                                    <p className="text-sm text-gray-400">Click to upload an image</p>
                                    <p className="text-xs text-gray-500">PNG, JPG, etc.</p>
                                </>
                            )}
                        </div>
                    </div>
                    <input ref={fileInputRef} type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                </div>
                <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">Editing Instructions</label>
                    <textarea
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Add a retro filter, remove the person in the background..."
                        className="w-full h-32 p-4 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-blue-light"
                        disabled={isLoading || !imageFile}
                    />
                </div>
            </div>

            <button
                onClick={handleGenerate}
                disabled={isLoading || !imageFile || !prompt.trim()}
                className="mt-6 w-full flex items-center justify-center bg-brand-blue-light hover:bg-brand-blue text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                {isLoading ? <Spinner /> : 'Apply Edits'}
            </button>
            
            {error && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</div>}

            {isLoading && (
                 <div className="mt-6 flex flex-col items-center justify-center text-gray-400">
                    <Spinner />
                    <p className="mt-2">Applying edits...</p>
                </div>
            )}
            
            {editedImageUrl && imagePreview && (
                <div className="mt-6">
                    <h3 className="text-xl font-bold mb-4 text-center">Comparison</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-center">
                            <h4 className="font-semibold mb-2">Original</h4>
                            <img src={imagePreview} alt="Original" className="rounded-lg shadow-lg w-full object-contain" />
                        </div>
                        <div className="text-center">
                            <h4 className="font-semibold mb-2">Edited</h4>
                            <img src={editedImageUrl} alt="Edited" className="rounded-lg shadow-lg w-full object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageEditor;
