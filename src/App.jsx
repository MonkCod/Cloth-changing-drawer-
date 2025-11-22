import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Loader2, Upload, Camera, Sparkles, CheckCircle2, Shirt, Sun, GitFork, Crown, Watch, AlertCircle } from 'lucide-react';

// --- CONFIGURATION ---
// Using the stable image-preview model to minimize rate limit errors.
const MODEL_NAME = "gemini-2.5-flash-image-preview";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

// --- STYLE DATA ---
const DRESS_CHOICES = {
  'Indian Traditional': [
    { name: "Bridal Lehenga", prompt: "A luxurious, deep crimson bridal lehenga choli, featuring heavy zardozi embroidery and crystal embellishments, paired with a sheer net dupatta draped elegantly over the head, photorealistic." },
    { name: "Banarasi Saree", prompt: "A classic emerald green silk Banarasi Saree with wide gold zari borders and traditional peacock motifs, draped in the Nivi style, with a matching sleeveless blouse, high resolution." },
    { name: "Anarkali Suit", prompt: "A floor-length, flared mustard yellow Anarkali suit made of Chanderi silk, featuring delicate white Chikankari embroidery and a high collared neck, high fashion editorial." },
    { name: "Ghagra Choli", prompt: "A vibrant Rajasthani Ghagra Choli with mirror work (Shisha embroidery) on a navy blue skirt and bright pink choli, complete with a Bandhani print dupatta, realistic texture." },
    { name: "Kanjivaram Saree", prompt: "A sophisticated purple and gold Kanjivaram silk saree, known for its heavy texture and contrast pallu, worn with traditional gold jewelry, high detail." },
    { name: "Sharara Suit", prompt: "An ivory georgette Sharara suit with subtle silver sequence work, featuring flared pants and a short, fitted peplum top, modern bridal look." },
  ],
  'Indo-Western': [
    { name: "Fusion Gown", prompt: "A floor-sweeping Indo-Western gown with a fitted bodice, full skirt, and intricate gold thread work, blending traditional motifs with a modern silhouette, realistic." },
    { name: "Jumpsuit with Cape", prompt: "A sleek black satin jumpsuit, tailored perfectly, layered with an asymmetrical, sheer organza cape featuring floral embroidery, sophisticated look." },
    { name: "Crop Top Lehenga", prompt: "A contemporary high-waisted lehenga skirt in a geometric print, paired with a matching structured crop top and minimal accessories, urban setting." },
    { name: "Draped Saree", prompt: "A pre-stitched, fluid saree draped in a modern, easy-to-wear style, made of chiffon in a pastel lavender shade with a thin metallic belt, high fashion." },
  ],
  'Beach & Swim': [
    { name: "High-Waist Bikini", prompt: "A high-waisted vintage style bikini set in a vibrant tropical floral pattern, with a balconette top and large straw hat, realistic beach photo." },
    { name: "One-Piece Monokini", prompt: "A high-cut, deep-V neck black monokini swimsuit with silver ring details, giving a sophisticated resort look, editorial style." },
    { name: "Maxi Sundress", prompt: "A breezy, white cotton tiered maxi sundress with thin spaghetti straps, perfect for a Mediterranean beach vacation, natural light." },
    { name: "Linen Co-ord", prompt: "A tailored linen shirt and matching wide-leg linen shorts co-ord set in a pale beige color, suitable for a beach club, realistic linen texture." },
  ],
  'Jackets Only': [
    { name: "Biker Leather Jacket", prompt: "A classic black leather biker jacket, heavily detailed with silver zippers, studs, and a belted waist, giving an edgy rock-and-roll look, realistic leather texture." },
    { name: "Quilted Puffer Jacket", prompt: "A glossy, oversized quilted puffer jacket in a metallic silver color, with a high stand collar, perfect for cold weather street style, high contrast." },
    { name: "Tailored Blazer", prompt: "A sharp, double-breasted tailored wool blazer in charcoal grey, worn over a simple top, giving a powerful professional aesthetic, high resolution." },
    { name: "Denim Trucker", prompt: "A distressed blue denim trucker jacket with shearling lining and vintage wash effects, styled casually with the collar popped, realistic denim." },
  ],
};

// --- HELPER FUNCTIONS ---
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const App = () => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [clothingPrompt, setClothingPrompt] = useState(DRESS_CHOICES['Indian Traditional'][0].prompt);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isComparing, setIsComparing] = useState(false); 
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Indian Traditional');
  const fileInputRef = useRef(null);

  const currentCategoryPrompts = useMemo(() => DRESS_CHOICES[selectedCategory], [selectedCategory]);

  // --- API KEY CONFIGURATION ---
  const apiKey = "AIzaSyCxou4XumgBqPEFurtEBWTPGgMIkpwhnw4"; // Key injected successfully
  // ----------------------------

  const handleFileChange = async (event) => {
    setErrorMessage('');
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please upload a valid image file (JPG or PNG).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Image is too large. Please use an image under 5MB.');
        return;
      }
      try {
        const base64Url = await fileToBase64(file);
        setUploadedImage(base64Url);
        setGeneratedImage(null);
      } catch (error) {
        setErrorMessage('Failed to read the image file.');
      }
    }
  };

  const generateNewClothes = useCallback(async () => {
    if (!apiKey) {
      setErrorMessage('System Error: API Key is missing in the code.');
      return;
    }
    if (!uploadedImage) {
      setErrorMessage('Please upload a photo first.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const [mimeTypePart, base64Data] = uploadedImage.split(';');
      const mimeType = mimeTypePart.split(':')[1];
      const base64Image = base64Data.split(',')[1];

      const promptText = `Edit the clothing in this image to match this description exactly: "${clothingPrompt}". Maintain the person's exact pose, face, body shape, and the background. Only change the outfit. Photorealistic quality.`;

      const payload = {
          contents: [{
              role: "user",
              parts: [{ text: promptText }, { inlineData: { mimeType: mimeType, data: base64Image } }]
          }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      };

      const res = await fetch(`${API_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("API Error Details:", errorData);
        
        if (res.status === 429) {
           throw new Error("Traffic Limit Reached. Please wait 60 seconds and try again.");
        } else if (res.status === 403) {
           throw new Error("Invalid API Key. Please check the key settings.");
        } else {
           throw new Error(`Server Error (${res.status}). Please try again.`);
        }
      }

      const result = await res.json();
      const base64Response = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

      if (base64Response) {
          setGeneratedImage(`data:image/png;base64,${base64Response}`);
      } else {
          throw new Error('The AI could not process this specific image. Please try another photo.');
      }

    } catch (error) {
        setErrorMessage(error.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [uploadedImage, clothingPrompt, apiKey]);

  const categoryIcons = {
    'Indian Traditional': Crown,
    'Indo-Western': GitFork,
    'Beach & Swim': Sun,
    'Jackets Only': Watch,
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
      {/* Mobile Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-sm safe-area-top">
        <div className="max-w-md mx-auto flex items-center justify-center relative">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              StyleAI
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-5">
        
        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 font-bold">Something went wrong</p>
              <p className="text-xs text-red-700 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Main Image Display - Mobile Optimized */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 relative aspect-[3/4]">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-lg font-bold text-slate-800 animate-pulse">Designing Outfit...</p>
              <p className="text-xs text-slate-500 mt-2 font-medium">This may take up to 30 seconds.</p>
            </div>
          )}
          
          {!uploadedImage ? (
            <div 
              onClick={() => fileInputRef.current.click()}
              className="w-full h-full flex flex-col items-center justify-center bg-slate-50 active:bg-slate-100 transition cursor-pointer p-6 text-center border-2 border-dashed border-slate-300 m-2 rounded-2xl w-[calc(100%-16px)] h-[calc(100%-16px)]"
            >
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mb-3 text-indigo-600 shadow-sm">
                <Camera className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-700">Add Photo</h3>
              <p className="text-xs text-slate-400 mt-1">Use a clear full-body shot</p>
            </div>
          ) : (
            <div className="relative w-full h-full">
               {/* Image Logic */}
               <img 
                src={(isComparing || !generatedImage) ? uploadedImage : generatedImage} 
                alt="Preview" 
                className="w-full h-full object-cover"
              />
              
              {/* Comparison Indicator */}
              {generatedImage && isComparing && (
                <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md z-20">
                  Original
                </div>
              )}

              {/* Actions */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                 <button 
                  onClick={() => {setUploadedImage(null); setGeneratedImage(null);}}
                  className="bg-white/90 p-2.5 rounded-full text-slate-700 shadow-lg backdrop-blur-sm active:scale-90 transition"
                >
                  <Upload className="w-5 h-5" />
                </button>
              </div>

              {/* Hold to Compare Button (Mobile Friendly) */}
              {generatedImage && (
                <button 
                  onTouchStart={(e) => { e.preventDefault(); setIsComparing(true); }}
                  onTouchEnd={(e) => { e.preventDefault(); setIsComparing(false); }}
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  className="absolute bottom-4 right-4 bg-black/70 text-white pl-4 pr-5 py-2.5 rounded-full text-xs font-bold backdrop-blur-md shadow-lg flex items-center gap-2 active:scale-95 transition select-none"
                >
                  <Watch className="w-3 h-3" /> Hold to Compare
                </button>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        {/* Controls Container */}
        <div className="space-y-5 pb-8">
          {/* Horizontal Category Scroll */}
          <div>
            <div className="flex space-x-2 overflow-x-auto pb-2 px-1 scrollbar-hide -mx-4 px-4">
              {Object.keys(DRESS_CHOICES).map((cat) => {
                const Icon = categoryIcons[cat];
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setClothingPrompt(DRESS_CHOICES[cat][0].prompt);
                    }}
                    className={`
                      flex items-center px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border
                      ${isActive 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                        : 'bg-white text-slate-500 border-slate-200'
                      }
                    `}
                  >
                    <Icon className="w-3 h-3 mr-1.5" />
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt Selection */}
          <div className="grid grid-cols-2 gap-2.5">
            {currentCategoryPrompts.map((choice) => (
              <button
                key={choice.name}
                onClick={() => setClothingPrompt(choice.prompt)}
                className={`
                  relative p-3 rounded-xl text-left transition-all duration-200 border active:scale-95
                  ${clothingPrompt === choice.prompt
                    ? 'bg-indigo-50 border-indigo-500 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-indigo-200'
                  }
                `}
              >
                <div className={`text-xs font-bold ${clothingPrompt === choice.prompt ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {choice.name}
                </div>
                {clothingPrompt === choice.prompt && (
                  <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-indigo-600" />
                )}
              </button>
            ))}
          </div>

          {/* Main Action Button */}
          <div className="pt-2 sticky bottom-4 z-40">
            <button
              onClick={generateNewClothes}
              disabled={isLoading || !uploadedImage}
              className={`
                w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2
                ${isLoading || !uploadedImage
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-300/50'
                }
              `}
            >
              {isLoading ? (
                <>Thinking...</>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 fill-white/20" /> 
                  Generate Outfit
                </>
              )}
            </button>
          </div>
          
          <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
            AI Virtual Try-On 2025
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;




// Utility function to convert File object to Base64 string
 
// --- REACT COMPONENT ---


    
        
                            
                  


      
