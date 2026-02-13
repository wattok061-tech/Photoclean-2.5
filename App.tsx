
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppView, PhotoCleanImage, CreditState, User, Resolution } from './types';
import { Button } from './components/Button';
import { editImageWithGemini } from './services/geminiService';

const Tooltip: React.FC<{ children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }> = ({ children, text, position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full mb-3 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-3 left-1/2 -translate-x-1/2',
    left: 'right-full mr-3 top-1/2 -translate-y-1/2',
    right: 'left-full ml-3 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[#1a1a1a]',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#1a1a1a]',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[#1a1a1a]',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[#1a1a1a]',
  };

  return (
    <div className="relative group inline-flex items-center">
      {children}
      <div className={`absolute ${positionClasses[position]} px-4 py-2 bg-[#111] border border-zinc-800 text-[8px] text-zinc-400 font-black uppercase tracking-[0.2em] whitespace-nowrap rounded-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-300 z-[100] shadow-2xl backdrop-blur-md`}>
        {text}
        <div className={`absolute border-4 border-transparent ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode }> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative w-full max-w-6xl bg-[#0a0a0a] border border-zinc-900 rounded-[48px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col md:flex-row max-h-[90vh]">
        <button onClick={onClose} className="absolute top-8 right-8 z-10 text-zinc-500 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<CreditState>({ remaining: 0, total: 10, hasClaimedInitial: false });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<PhotoCleanImage | null>(null);
  const [editedImage, setEditedImage] = useState<PhotoCleanImage | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PhotoCleanImage[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [selectedResolution, setSelectedResolution] = useState<Resolution>('1K');
  
  // Gallery states
  const [searchQuery, setSearchQuery] = useState('');
  const [galleryFilter, setGalleryFilter] = useState<Resolution | 'ALL'>('ALL');
  const [selectedProject, setSelectedProject] = useState<PhotoCleanImage | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('pc_premium_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setCredits({ remaining: 10, total: 10, hasClaimedInitial: true });
      setView(AppView.DASHBOARD);
    }
    const savedHistory = localStorage.getItem('pc_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('pc_history', JSON.stringify(history));
    }
  }, [history]);

  const handleGoogleAuth = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setView(AppView.ONBOARDING);
    }, 1200);
  };

  const completeOnboarding = () => {
    setView(AppView.CLAIM_CREDITS);
  };

  const claimCredits = () => {
    const finalUser = { 
      email: 'creator@photoclean.ai', 
      name: 'Creative Partner', 
      isNew: false 
    };
    setUser(finalUser);
    setCredits({ remaining: 10, total: 10, hasClaimedInitial: true });
    localStorage.setItem('pc_premium_user', JSON.stringify(finalUser));
    setView(AppView.DASHBOARD);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCurrentImage({
          url: event.target?.result as string,
          id: Date.now().toString(),
          name: file.name,
          createdAt: Date.now()
        });
        setView(AppView.EDITOR);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setIsProcessing(true);
    try {
      new URL(urlInput);
      setCurrentImage({
        url: urlInput,
        id: Date.now().toString(),
        name: 'Remote Asset',
        createdAt: Date.now()
      });
      setView(AppView.EDITOR);
      setUrlInput('');
    } catch (err) {
      setError("The provided URL is invalid.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getCreditCost = (res: Resolution) => {
    if (res === '4K') return 3;
    if (res === '2K') return 2;
    return 1;
  };

  const processEdit = async () => {
    if (!currentImage || !prompt) return;
    const cost = getCreditCost(selectedResolution);
    if (credits.remaining < cost) {
      setError(`Insufficient studio balance.`);
      return;
    }

    if (selectedResolution !== '1K') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setError("High-resolution exports (2K/4K) require a paid API key.");
        await (window as any).aistudio.openSelectKey();
        return;
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      let base64 = currentImage.url;
      if (!base64.startsWith('data:')) {
        const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(currentImage.url)}`);
        const blob = await response.blob();
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const mimeType = base64.split(';')[0].split(':')[1];
      const resultBase64 = await editImageWithGemini(base64, mimeType, prompt, selectedResolution);
      
      const newEdited = {
        url: resultBase64,
        id: `edit-${Date.now()}`,
        name: `Cleaned ${currentImage.name}`,
        originalUrl: currentImage.url,
        createdAt: Date.now(),
        resolution: selectedResolution,
        prompt: prompt
      };
      
      setEditedImage(newEdited);
      setHistory(prev => [newEdited, ...prev]);
      setCredits(prev => ({ ...prev, remaining: prev.remaining - cost }));
    } catch (err: any) {
      setError("Synthesis failed. Check your API key or connection.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('pc_premium_user');
    localStorage.removeItem('pc_history');
    setUser(null);
    setHistory([]);
    setView(AppView.LANDING);
    setCredits({ remaining: 0, total: 10, hasClaimedInitial: false });
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = galleryFilter === 'ALL' || item.resolution === galleryFilter;
      return matchesSearch && matchesFilter;
    });
  }, [history, searchQuery, galleryFilter]);

  if (view === AppView.LANDING) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <nav className="fixed top-0 w-full z-50 px-8 py-8 flex justify-between items-center bg-gradient-to-b from-[#050505] to-transparent">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-white rounded flex items-center justify-center transition-transform duration-500 hover:rotate-90">
                <div className="w-4 h-4 bg-black rounded-sm"></div>
             </div>
             <span className="font-bold tracking-tighter text-xl uppercase">PHOTOCLEAN.</span>
          </div>
          <div className="flex items-center gap-8">
            <button onClick={() => setView(AppView.AUTH)} className="text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest duration-500">Sign In</button>
            <Button onClick={() => setView(AppView.AUTH)} className="bg-white text-black px-8 py-3 rounded-full text-xs uppercase tracking-widest">Start Creating</Button>
          </div>
        </nav>
        <section className="flex flex-col items-center justify-center pt-64 pb-32 px-6 text-center overflow-hidden">
          <div className="max-w-5xl space-y-12 animate-slide-up relative">
            <h1 className="text-7xl md:text-[10rem] font-black tracking-tighter leading-[0.85] gradient-text pb-4">
              ERASE THE<br />IMPERFECT.
            </h1>
            <p className="text-zinc-500 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-medium">
              Professional-grade AI object removal. Transform your captures instantly.
            </p>
            <Button className="px-14 py-6 mx-auto text-sm uppercase tracking-widest rounded-full bg-white text-black" onClick={() => setView(AppView.AUTH)}>Open Studio</Button>
          </div>
        </section>
      </div>
    );
  }

  if (view === AppView.AUTH) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative">
        <div className="w-full max-w-md space-y-12 animate-slide-up text-center">
           <h2 className="text-4xl font-black uppercase">Studio Access</h2>
           <button 
             onClick={handleGoogleAuth}
             className="w-full flex items-center justify-center gap-4 bg-white hover:bg-zinc-200 text-black py-5 px-8 rounded-2xl font-black uppercase tracking-[0.2em]"
           >
             Continue with Google
           </button>
           <button onClick={() => setView(AppView.LANDING)} className="text-zinc-600 uppercase text-[10px] font-black">Return</button>
        </div>
      </div>
    );
  }

  if (view === AppView.ONBOARDING) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
        <div className="max-w-xl w-full space-y-12 animate-slide-up">
           <h1 className="text-4xl font-black uppercase">Your primary focus?</h1>
           {["Product Photography", "Graphic Design", "Creative Arts"].map((opt) => (
             <button key={opt} onClick={completeOnboarding} className="w-full py-6 px-10 rounded-3xl bg-[#0a0a0a] border border-zinc-900 hover:border-zinc-600 transition-all text-white font-bold uppercase tracking-widest">{opt}</button>
           ))}
        </div>
      </div>
    );
  }

  if (view === AppView.CLAIM_CREDITS) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-10 animate-slide-up">
           <div className="bg-[#0a0a0a] border border-zinc-800 rounded-[40px] p-12">
              <div className="text-6xl font-black">10</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-[0.4em]">Starter Credits</div>
           </div>
           <Button className="w-full py-6" onClick={claimCredits}>Initialize Studio</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex">
      <aside className="w-80 h-screen border-r border-zinc-900 bg-black flex flex-col sticky top-0 z-40 p-8">
        <div className="flex items-center gap-3 mb-16 cursor-pointer group" onClick={() => setView(AppView.DASHBOARD)}>
          <div className="w-6 h-6 bg-white rounded flex items-center justify-center transition-transform duration-500 group-hover:rotate-90"><div className="w-3 h-3 bg-black rounded-sm"></div></div>
          <span className="font-black text-lg tracking-tighter uppercase">PHOTOCLEAN</span>
        </div>
        <nav className="flex-1 space-y-2">
          {[
            { id: AppView.DASHBOARD, label: 'Dashboard' },
            { id: AppView.GALLERY, label: 'Gallery' },
            { id: AppView.SUBSCRIPTION, label: 'Subscription' }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => { setView(item.id); setEditedImage(null); }} 
              className={`sidebar-item w-full text-left px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${view === item.id ? 'bg-[#0f0f0f] text-white shadow-xl' : 'text-zinc-600 hover:text-white hover:bg-white/5'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="mt-auto space-y-6">
          <div className="bg-[#0a0a0a] border border-zinc-900 rounded-[32px] p-6 space-y-5">
             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-500">
                <span>Refinement Power</span>
                <span className="text-white">{credits.remaining}/{credits.total}</span>
             </div>
             <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-1000" style={{ width: `${(credits.remaining / credits.total) * 100}%` }}></div>
             </div>
             <button onClick={() => setView(AppView.SUBSCRIPTION)} className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors">Recharge Studio</button>
          </div>

          <div className="flex items-center gap-4 border-t border-zinc-900 pt-8 group">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 border border-zinc-800 flex items-center justify-center shadow-lg overflow-hidden transition-transform duration-500 group-hover:scale-110">
                <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user?.email || 'studio'}`} alt="PFP" />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white truncate uppercase tracking-widest">{user?.name || 'STUDIO USER'}</p>
                <button onClick={logout} className="text-[9px] text-zinc-600 hover:text-white uppercase font-black tracking-widest transition-colors">Sign Out</button>
             </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-12 relative">
        {view === AppView.DASHBOARD && (
          <div className="max-w-6xl mx-auto space-y-16 animate-slide-up">
            <header className="space-y-4">
               <h1 className="text-6xl font-black uppercase tracking-tighter">STUDIO</h1>
               <div className="w-full bg-[#0a0a0a] border border-zinc-900 rounded-[40px] p-12 flex flex-col md:flex-row gap-8 items-center shadow-2xl">
                  <form onSubmit={handleUrlSubmit} className="flex-1 flex gap-4 w-full">
                    <input type="text" placeholder="Import remote image URL..." className="flex-1 bg-black border border-zinc-900 rounded-2xl px-6 py-4 text-xs text-white focus:outline-none focus:border-white transition-all" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
                    <Button className="px-10 py-4 uppercase text-[10px]">Fetch</Button>
                  </form>
                  <div className="w-px h-12 bg-zinc-900 hidden md:block"></div>
                  <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="px-10 py-4 uppercase text-[10px]">Upload Local</Button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
               </div>
            </header>
            
            <section className="space-y-8">
               <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Recently Refined</h2>
                  <button onClick={() => setView(AppView.GALLERY)} className="text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-colors">View All</button>
               </div>
               {history.length === 0 ? <p className="text-[10px] uppercase text-zinc-800 tracking-[0.4em] text-center py-20">No history yet.</p> : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                   {history.slice(0, 3).map(item => (
                     <div key={item.id} className="group cursor-pointer space-y-4" onClick={() => { setSelectedProject(item); }}>
                        <div className="aspect-[16/10] bg-[#0a0a0a] rounded-[32px] overflow-hidden border border-zinc-900 group-hover:border-zinc-500 relative shadow-lg">
                           <img src={item.url} className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                           <div className="absolute top-4 right-4 bg-black/80 px-3 py-1 rounded-full text-[8px] font-black border border-zinc-800 uppercase tracking-widest">{item.resolution || '1K'}</div>
                        </div>
                        <div className="px-4">
                           <h3 className="text-[10px] font-black text-white uppercase tracking-widest truncate">{item.name}</h3>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </section>
          </div>
        )}

        {view === AppView.GALLERY && (
          <div className="max-w-7xl mx-auto space-y-16 animate-slide-up pb-32">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
               <div className="space-y-4">
                  <div className="h-1 w-12 bg-white"></div>
                  <h1 className="text-6xl font-black uppercase tracking-tighter">GALLERY</h1>
                  <p className="text-zinc-600 font-medium text-sm tracking-widest uppercase">Your Creative Evolution.</p>
               </div>
               
               <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                  <div className="relative group w-full sm:w-80">
                    <input 
                      type="text" 
                      placeholder="Search projects..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-zinc-900 rounded-2xl px-6 py-4 pl-12 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-500 transition-all"
                    />
                    <svg className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-zinc-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </div>
                  
                  <div className="flex gap-2">
                     {(['ALL', '1K', '2K', '4K'] as const).map(res => (
                       <button 
                         key={res} 
                         onClick={() => setGalleryFilter(res)}
                         className={`px-6 py-4 rounded-2xl text-[10px] font-black border transition-all uppercase tracking-widest ${galleryFilter === res ? 'bg-white text-black border-white shadow-lg' : 'bg-transparent text-zinc-600 border-zinc-900 hover:border-zinc-500 hover:text-white'}`}
                       >
                         {res}
                       </button>
                     ))}
                  </div>
               </div>
            </header>

            <section className="animate-slide-up">
              {filteredHistory.length === 0 ? (
                <div className="py-64 flex flex-col items-center justify-center gap-8 text-zinc-800 opacity-30 text-center">
                   <div className="w-20 h-20 border border-zinc-900 rounded-full flex items-center justify-center animate-pulse mb-4">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                   </div>
                   <p className="text-xs font-black uppercase tracking-[0.5em]">{searchQuery ? "No results found." : "Your archive is currently empty."}</p>
                   {searchQuery && <Button onClick={() => setSearchQuery('')} variant="secondary" className="px-8 py-3 rounded-full uppercase text-[10px]">Clear Search</Button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                   {filteredHistory.map(item => (
                    <div 
                      key={item.id} 
                      className="group relative bg-[#0a0a0a] border border-zinc-900 rounded-[40px] overflow-hidden transition-all duration-700 hover:border-zinc-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]"
                    >
                        <div className="aspect-[4/3] relative overflow-hidden cursor-pointer" onClick={() => setSelectedProject(item)}>
                           <img src={item.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000" />
                           <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                           
                           <div className="absolute top-6 right-6 flex gap-2">
                             <div className="bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-full text-[8px] font-black border border-zinc-800 uppercase tracking-widest">{item.resolution || '1K'}</div>
                           </div>
                           
                           <div className="absolute bottom-6 left-6 right-6 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                             <Button onClick={(e) => { e.stopPropagation(); setCurrentImage(item); setEditedImage(null); setView(AppView.EDITOR); }} className="w-full py-3 rounded-2xl uppercase text-[9px] tracking-[0.2em] shadow-2xl">Re-Open Studio</Button>
                           </div>
                        </div>
                        
                        <div className="p-8 flex items-center justify-between gap-4">
                           <div className="min-w-0 flex-1">
                              <h3 className="text-[11px] font-black uppercase tracking-widest text-white truncate">{item.name}</h3>
                              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1">{new Date(item.createdAt).toLocaleDateString()}</p>
                           </div>
                           <Tooltip text="Direct Export" position="top">
                             <button 
                               onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = item.url; link.download = `${item.name}.png`; link.click(); }}
                               className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:border-white transition-all"
                             >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                             </button>
                           </Tooltip>
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <Modal isOpen={!!selectedProject} onClose={() => setSelectedProject(null)}>
          {selectedProject && (
            <>
              <div className="flex-1 bg-black flex items-center justify-center p-8 min-h-[400px]">
                <img src={selectedProject.url} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl shadow-black/50" />
              </div>
              <div className="w-full md:w-96 border-l border-zinc-900 p-12 flex flex-col justify-between">
                <div className="space-y-12">
                   <header className="space-y-4">
                      <div className="h-1 w-8 bg-white"></div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{selectedProject.name}</h2>
                      <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">{new Date(selectedProject.createdAt).toLocaleString()}</p>
                   </header>
                   
                   <div className="space-y-8">
                      <div className="space-y-3">
                         <label className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-700">Refinement Instruction</label>
                         <p className="text-zinc-400 text-sm leading-relaxed italic">{selectedProject.prompt || "No prompt recorded."}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-[#0f0f0f] border border-zinc-900 rounded-2xl p-4">
                            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-700 block mb-1">Export Scale</label>
                            <span className="text-white font-black text-xs">{selectedProject.resolution || '1K'}</span>
                         </div>
                         <div className="bg-[#0f0f0f] border border-zinc-900 rounded-2xl p-4">
                            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-700 block mb-1">Status</label>
                            <span className="text-green-500 font-black text-xs uppercase">Validated</span>
                         </div>
                      </div>
                   </div>
                </div>
                
                <div className="space-y-4 pt-12">
                   <Button onClick={() => { const link = document.createElement('a'); link.href = selectedProject.url; link.download = `${selectedProject.name}.png`; link.click(); }} className="w-full py-5 rounded-3xl uppercase text-[10px] tracking-widest">Download Full-Res</Button>
                   <Button variant="secondary" onClick={() => { setCurrentImage(selectedProject); setEditedImage(null); setView(AppView.EDITOR); setSelectedProject(null); }} className="w-full py-5 rounded-3xl uppercase text-[10px] tracking-widest">Load in Studio</Button>
                   <button 
                    onClick={() => { setHistory(prev => prev.filter(p => p.id !== selectedProject.id)); setSelectedProject(null); }}
                    className="w-full py-4 text-[9px] font-black uppercase tracking-widest text-red-900 hover:text-red-500 transition-colors"
                   >
                     Delete Project
                   </button>
                </div>
              </div>
            </>
          )}
        </Modal>

        {view === AppView.SUBSCRIPTION && (
          <div className="max-w-6xl mx-auto space-y-16 animate-slide-up">
            <header className="space-y-4">
               <div className="h-1 w-12 bg-white"></div>
               <h1 className="text-6xl font-black uppercase tracking-tighter">SUBSCRIPTION</h1>
               <p className="text-zinc-600 font-medium text-sm tracking-widest uppercase">Choose your refinement capacity.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               {[
                 { name: "Free", price: "$0", features: ["1K Refinement", "10 Initial Credits", "Standard Queue"], active: true },
                 { name: "Pro Studio", price: "$19", features: ["2K/4K Support", "100 Monthly Credits", "Priority Processing", "Batch Cleanup"] },
                 { name: "Enterprise", price: "$99", features: ["Unlimited Credits", "API Access", "Custom Model Tuning", "Dedicated Support"] }
               ].map(plan => (
                 <div key={plan.name} className={`bg-[#0a0a0a] border ${plan.name === 'Pro Studio' ? 'border-white shadow-[0_0_50px_-20px_rgba(255,255,255,0.3)]' : 'border-zinc-900'} rounded-[40px] p-12 space-y-10 flex flex-col group hover:-translate-y-2 transition-all duration-500`}>
                    <div className="space-y-4">
                       <h3 className="text-2xl font-black uppercase">{plan.name}</h3>
                       <div className="text-5xl font-black tracking-tighter">{plan.price}<span className="text-sm font-medium text-zinc-600">/mo</span></div>
                    </div>
                    <ul className="space-y-4 flex-1">
                       {plan.features.map(f => (
                         <li key={f} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            <div className="w-1.5 h-1.5 bg-white rounded-full group-hover:scale-150 transition-transform"></div> {f}
                         </li>
                       ))}
                    </ul>
                    <Button variant={plan.name === 'Pro Studio' ? 'primary' : 'secondary'} className="w-full py-5 rounded-3xl" onClick={() => window.open('https://ai.google.dev/gemini-api/docs/billing')}>
                       {plan.active ? 'Current Plan' : 'Select Plan'}
                    </Button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {view === AppView.EDITOR && currentImage && (
          <div className="max-w-7xl mx-auto h-[calc(100vh-6rem)] grid grid-cols-12 gap-12 animate-slide-up">
            <div className="col-span-8 flex flex-col gap-8">
               <div className="flex items-center justify-between">
                  <button onClick={() => setView(AppView.DASHBOARD)} className="text-[9px] font-black uppercase text-zinc-700 hover:text-white flex items-center gap-2 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg> EXIT
                  </button>
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-700">ENGINE: <span className="text-white">{selectedResolution === '1K' ? 'FLASH' : 'PRO'} 2.5</span></div>
               </div>
               <div className="flex-1 bg-black rounded-[48px] border border-zinc-900 overflow-hidden relative shadow-2xl flex items-center justify-center">
                  <img src={editedImage?.url || currentImage.url} className={`max-h-[85%] max-w-[85%] object-contain transition-all duration-1000 ${isProcessing ? 'blur-2xl opacity-20 scale-95' : 'opacity-100 scale-100'}`} />
                  {isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 text-center bg-black/40 backdrop-blur-sm animate-in fade-in">
                        <div className="w-24 h-24 border-2 border-zinc-900 border-t-white rounded-full animate-spin"></div>
                        <p className="text-zinc-600 text-[9px] uppercase tracking-[0.4em] font-black">Synthesizing Texture...</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="col-span-4 flex flex-col py-10 space-y-12">
               <div className="space-y-4">
                 <h2 className="text-4xl font-black uppercase tracking-tighter">REFINEMENT</h2>
                 <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Describe what you want gone.</p>
               </div>
               <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-700">Instruction</label>
                    <textarea rows={6} className="w-full bg-black border border-zinc-900 rounded-[32px] p-8 text-white focus:outline-none focus:border-white transition-all resize-none text-[11px]" placeholder="e.g. 'the tree on the right'..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-700">Resolution</label>
                    <div className="grid grid-cols-3 gap-3">
                       {(['1K', '2K', '4K'] as Resolution[]).map(res => (
                         <button key={res} onClick={() => setSelectedResolution(res)} className={`py-3 rounded-2xl border transition-all text-[9px] font-black uppercase ${selectedResolution === res ? 'bg-white text-black shadow-lg' : 'bg-black text-zinc-600 border-zinc-900 hover:border-zinc-700'}`}>{res} ({getCreditCost(res)}c)</button>
                       ))}
                    </div>
                  </div>
                  <Button className="w-full py-6 rounded-full uppercase text-[10px]" onClick={processEdit} isLoading={isProcessing} disabled={!prompt.trim() || credits.remaining < getCreditCost(selectedResolution)}>EXECUTE CLEANSE</Button>
                  {error && <p className="text-red-500 text-[9px] font-black uppercase text-center mt-4 animate-bounce">{error}</p>}
                  {editedImage && (
                     <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-4">
                        <Button variant="secondary" className="w-full py-4 text-[9px] uppercase rounded-full" onClick={() => { const link = document.createElement('a'); link.href = editedImage.url; link.download = `photoclean.png`; link.click(); }}>Save</Button>
                        <Button variant="secondary" className="w-full py-4 text-[9px] uppercase rounded-full" onClick={() => { setCurrentImage(editedImage); setEditedImage(null); setPrompt(''); }}>Refine Again</Button>
                     </div>
                  )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
