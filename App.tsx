import React, { useState } from 'react';
import NewsAnalyzer from './components/NewsAnalyzer';
import ChatBot from './components/ChatBot';
import ImageGenerator from './components/ImageGenerator';
import VideoGenerator from './components/VideoGenerator';
import ImageEditor from './components/ImageEditor';
import LiveChat from './components/LiveChat';
import Transcriber from './components/Transcriber';

import { SparklesIcon } from './components/icons/SparklesIcon';
import { TabButton } from './components/TabButton';
import { DocumentTextIcon } from './components/icons/DocumentTextIcon';
import { ChatBubbleIcon } from './components/icons/ChatBubbleIcon';
import { ImageIcon } from './components/icons/ImageIcon';
import { VideoIcon } from './components/icons/VideoIcon';
import { PencilSquareIcon } from './components/icons/PencilSquareIcon';
import { AudioWaveIcon } from './components/icons/AudioWaveIcon';
import { MicrophoneIcon } from './components/icons/MicrophoneIcon';


type Tab = 'analyzer' | 'chat' | 'image' | 'editor' | 'video' | 'live' | 'transcriber';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('analyzer');

    const renderContent = () => {
        switch(activeTab) {
            case 'analyzer': return <NewsAnalyzer />;
            case 'chat': return <ChatBot />;
            case 'image': return <ImageGenerator />;
            case 'editor': return <ImageEditor />;
            case 'video': return <VideoGenerator />;
            case 'live': return <LiveChat />;
            case 'transcriber': return <Transcriber />;
            default: return <NewsAnalyzer />;
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-brand-gray-darker text-gray-900 dark:text-gray-100 font-sans">
            <header className="bg-white/5 backdrop-blur-sm shadow-md sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-2 flex-shrink-0">
                            <SparklesIcon className="h-8 w-8 text-brand-blue-light" />
                            <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                                Verity Lens
                            </h1>
                        </div>
                        <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto p-1 -mr-1 sm:mr-0">
                            <TabButton label="Analyzer" isActive={activeTab === 'analyzer'} onClick={() => setActiveTab('analyzer')} icon={<DocumentTextIcon className="w-5 h-5"/>} />
                            <TabButton label="Chat" isActive={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<ChatBubbleIcon className="w-5 h-5"/>}/>
                            <TabButton label="Image Gen" isActive={activeTab === 'image'} onClick={() => setActiveTab('image')} icon={<ImageIcon className="w-5 h-5"/>}/>
                            <TabButton label="Image Edit" isActive={activeTab === 'editor'} onClick={() => setActiveTab('editor')} icon={<PencilSquareIcon className="w-5 h-5"/>}/>
                            <TabButton label="Video" isActive={activeTab === 'video'} onClick={() => setActiveTab('video')} icon={<VideoIcon className="w-5 h-5"/>}/>
                            <TabButton label="Live Chat" isActive={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<AudioWaveIcon className="w-5 h-5"/>}/>
                            <TabButton label="Transcribe" isActive={activeTab === 'transcriber'} onClick={() => setActiveTab('transcriber')} icon={<MicrophoneIcon className="w-5 h-5"/>}/>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="animate-fade-in">
                    {renderContent()}
                </div>
            </main>
            
            <footer className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                <p>&copy; {new Date().getFullYear()} Verity Lens. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;