import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Loader2, Zap, Upload, Image as ImageIcon, GitFork, Crown, Sun, Watch, Shirt } from 'lucide-react';

// --- CONFIGURATION AND UTILITIES ---

const MODEL_NAME = "gemini-2.5-flash-image-preview";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

// Categorized dress choices with highly descriptive AI prompts
const DRESS_CHOICES = {
  'Indian Traditional': [
    { name: "Bridal Lehenga", prompt: "A luxurious, deep crimson bridal lehenga choli, featuring heavy zardozi embroidery and crystal embellishments, paired with a sheer net dupatta draped elegantly over the head, photorealistic." },
    { name: "Banarasi Saree", prompt: "A classic emerald green silk Banarasi Saree with wide gold zari borders and traditional peacock motifs, draped in the Nivi style, with a matching sleeveless blouse, high resolution." },
    { name: "Anarkali Suit", prompt: "A floor-length, flared mustard yellow Anarkali suit made of Chanderi silk, featuring delicate white Chikankari embroidery and a high collared neck, high fashion editorial." },
    { name: "Ghagra Choli", prompt: "A vibrant Rajasthani Ghagra Choli with mirror work (Shisha embroidery) on a navy blue skirt and bright pink choli, complete with a Bandhani print dupatta, realistic texture." },
    { name: "Kanjivaram Saree", prompt: "A sophisticated purple and gold Kanjivaram silk saree, known for its heavy texture and contrast pallu, worn with traditional gold jewelry, high detail." },
    { name: "Patiala Salwar", prompt: "A comfortable, everyday cotton Patiala Salwar suit in sky blue, featuring simple block printing and a short Kurti with side slits, casual style." },
    { name: "Sharara Suit", prompt: "An ivory georgette Sharara suit with subtle silver sequence work, featuring flared pants and a short, fitted peplum top, modern bridal look." },
  ],
  'Indo-Western': [
    { name: "Fusion Gown", prompt: "A floor-sweeping Indo-Western gown with a fitted bodice, full skirt, and intricate gold thread work, blending traditional motifs with a modern silhouette, realistic." },
    { name: "Jumpsuit with Cape", prompt: "A sleek black satin jumpsuit, tailored perfectly, layered with an asymmetrical, sheer organza cape featuring floral embroidery, sophisticated look." },
    { name: "Crop Top Lehenga", prompt: "A contemporary high-waisted lehenga skirt in a geometric print, paired with a matching structured crop top and minimal accessories, urban setting." },
    { name: "Kurta Dress", prompt: "A stylish mid-length A-line Kurta worn as a dress, made of handloom cotton with natural dyes and tribal block prints, simple elegant." },
    { name: "Draped Saree", prompt: "A pre-stitched, fluid saree draped in a modern, easy-to-wear style, made of chiffon in a pastel lavender shade with a thin metallic belt, high fashion." },
    { name: "Palazzo Set", prompt: "A relaxed co-ord set featuring wide-leg palazzo pants and a long, straight tunic with metallic button details, made of breathable linen, bohemian chic." },
  ],
  'Beach & Swim': [
    { name: "High-Waist Bikini", prompt: "A high-waisted vintage style bikini set in a vibrant tropical floral pattern, with a balconette top and large straw hat, realistic beach photo." },
    { name: "String Bikini", prompt: "A neon yellow string bikini with minimal coverage, shown on the body, with wet hair and a relaxed, sun-kissed look, high detail photograph." },
    { name: "One-Piece Monokini", prompt: "A high-cut, deep-V neck black monokini swimsuit with silver ring details, giving a sophisticated resort look, editorial style." },
    { name: "Maxi Sundress", prompt: "A breezy, white cotton tiered maxi sundress with thin spaghetti straps, perfect for a Mediterranean beach vacation, natural light." },
    { name: "Linen Co-ord", prompt: "A tailored linen shirt and matching wide-leg linen shorts co-ord set in a pale beige color, suitable for a beach club, realistic linen texture." },
    { name: "Sarong Wrap", prompt: "A simple, sheer turquoise sarong wrap tied elegantly around the waist over a discreet swimsuit bottom, with bohemian jewelry, focus on fabric drape." },
  ],
  'Jackets Only': [
    { name: "Biker Leather Jacket", prompt: "A classic black leather biker jacket, heavily detailed with silver zippers, studs, and a belted waist, giving an edgy rock-and-roll look, realistic leather texture." },
    { name: "Quilted Puffer Jacket", prompt: "A glossy, oversized quilted puffer jacket in a metallic silver color, with a high stand collar, perfect for cold weather street style, high contrast." },
    { name: "Tailored Blazer", prompt: "A sharp, double-breasted tailored wool blazer in charcoal grey, worn over a simple top, giving a powerful professional aesthetic, high resolution." },
    { name: "Denim Trucker", prompt: "A distressed blue denim trucker jacket with shearling lining and vintage wash effects, styled casually with the collar popped, realistic denim." },
    { name: "Bomber Jacket", prompt: "A sleek olive green satin bomber jacket with orange lining details on the cuffs and collar, featuring minimal chest patches, casual urban style." },
    { name: "Trench Coat", prompt: "A long, flowing classic camel-colored trench coat, belted tightly at the waist, made of crisp gabardine fabric, high fashion photo." },
  ],
};


// Utility function to convert File object to Base64 string
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

// Retry logic for API calls
const withRetry = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};


// --- REACT COMPONENT ---

const App = () => {
  const [uploadedImage, setUploadedImage] = useState(null); 
  // Initialize with the first prompt from the first category
  const [clothingPrompt, setClothingPrompt] = useState(DRESS_CHOICES['Indian Traditional'][0].prompt);
  const [generatedImage, setGeneratedImage] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Indian Traditional');
  const fileInputRef = useRef(null);

  const currentCategoryPrompts = useMemo(() => DRESS_CHOICES[selectedCategory], [selectedCategory]);

  // Handle file selection and conversion to base64
  const handleFileChange = async (event) => {
    setErrorMessage('');
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrorMessage('Image size must be less than 5MB.');
        return;
      }
      try {
        const base64Url = await fileToBase64(file);
        setUploadedImage(base64Url);
        setGeneratedImage(null); 
      } catch (error) {
        setErrorMessage('Failed to process image file.');
        console.error('File reading error:', error);
      }
    } else if (file) {
        setErrorMessage('Please upload a valid image file (JPEG, PNG, etc.).');
    }
  };

  // Main API call function
  const generateNewClothes = useCallback(async () => {
    if (!uploadedImage || !clothingPrompt) {
      setErrorMessage('Please upload a photo and enter a clothing prompt.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setGeneratedImage(null);

    const [mimeTypePart, base64Data] = uploadedImage.split(';');
    const mimeType = mimeTypePart.split(':')[1];
    const base64Image = base64Data.split(',')[1];

    const promptText = `Please edit the person's current outfit in the provided image to replace it entirely with a highly realistic, new outfit matching this description: "${clothingPrompt}". Ensure the new clothing looks photorealistic, fits the body shape naturally, and maintains the original pose, lighting, and background quality. Use a professional fashion photography style.`;

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: promptText },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image,
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
        },
    };

    const apiKey = "AIzaSyCxou4XumgBqPEFurtEBWTPGgMIkpwhnw4"; 

    try {
        const response = await withRetry(async () => {
            const res = await fetch(`${API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorBody = await res.json();
                throw new Error(errorBody.error?.message || `API request failed with status ${res.status}`);
            }

            return res.json();
        });

        const result = response.candidates?.[0];
        const base64Data = result?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (base64Data) {
            setGeneratedImage(`data:image/png;base64,${base64Data}`);
        } else {
            setErrorMessage('Image generation failed. Please try a different prompt or image.');
        }

    } catch (error) {
        console.error('Generation Error:', error);
        setErrorMessage(`Generation failed: ${error.message || 'An unknown error occurred. Make sure your uploaded image clearly shows the person and their existing clothes.'}`);
    } finally {
      setIsLoading(false);
    }
  }, [uploadedImage, clothingPrompt]);


  // Helper component for the image upload button
  const UploadButton = () => (
    <button
      onClick={() => fileInputRef.current.click()}
      className={`
        w-full py-4 text-center rounded-xl font-semibold transition duration-300
        ${uploadedImage 
            ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
            : 'bg-gray-100 text-gray-700 border-2 border-dashed border-gray-300 hover:bg-gray-200'
        }
      `}
      type="button"
    >
      <Upload className="inline w-5 h-5 mr-2 -mt-1" />
      {uploadedImage ? 'Change Photo (Max 5MB)' : 'Upload Your Photo (JPG or PNG)'}
    </button>
  );

  // Icon mapping for categories
  const categoryIcons = {
    'Indian Traditional': Crown,
    'Indo-Western': GitFork,
    'Beach & Swim': Sun,
    'Jackets Only': Watch,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl bg-white shadow-2xl rounded-3xl p-6 md:p-10 mt-4 mb-4">
        <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-1">
          <Zap className="inline w-7 h-7 text-indigo-500 mr-2 -mt-1" />
          AI Virtual Try-On Studio
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Upload your photo and select a detailed style from the categories below.
        </p>

        {/* --- Upload and Controls Section (Mobile-first stack) --- */}
        <div className="mb-8">
          <input
            type="file"
            accept="image/jpeg, image/png"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
          />
          <UploadButton />
        </div>

        {/* --- Category and Prompt Selection --- */}
        <div className="mb-8 p-4 border border-gray-200 rounded-xl bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Choose a Style Category</h2>
            
            {/* Category Tabs */}
            <div className="flex space-x-2 border-b border-gray-300 overflow-x-auto pb-1 mb-4">
                {Object.keys(DRESS_CHOICES).map((category) => {
                    const Icon = categoryIcons[category] || Shirt;
                    const isActive = selectedCategory === category;
                    return (
                        <button
                            key={category}
                            onClick={() => {
                                setSelectedCategory(category);
                                setClothingPrompt(DRESS_CHOICES[category][0].prompt); // Set default prompt for new category
                            }}
                            className={`
                                flex-shrink-0 flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition duration-150
                                ${isActive 
                                    ? 'bg-white border-b-2 border-indigo-600 text-indigo-700 shadow-t-sm' 
                                    : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-100'
                                }
                            `}
                        >
                            <Icon className="w-4 h-4 mr-2" />
                            {category}
                        </button>
                    );
                })}
            </div>

            {/* Prompt Buttons for Selected Category */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {currentCategoryPrompts.map((choice) => (
                    <button
                        key={choice.name}
                        onClick={() => setClothingPrompt(choice.prompt)}
                        className={`
                            p-3 text-sm font-medium rounded-lg text-left transition-all duration-150 border-2
                            ${clothingPrompt === choice.prompt
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-indigo-50 hover:border-indigo-400'
                            }
                        `}
                    >
                        {choice.name}
                    </button>
                ))}
            </div>
        </div>


        {/* --- Prompt Input and Generation Button --- */}
        <div className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-gray-800">Prompt Details (Editable)</h2>
            <div className="relative">
                <textarea
                  value={clothingPrompt}
                  onChange={(e) => setClothingPrompt(e.target.value)}
                  placeholder="Describe your desired outfit here..."
                  className="w-full p-4 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm h-32 resize-none"
                  disabled={isLoading}
                />
                <div className="absolute bottom-3 right-4 text-sm text-gray-400">
                    {clothingPrompt.length} characters
                </div>
            </div>

            <button
                onClick={generateNewClothes}
                disabled={isLoading || !uploadedImage}
                className={`
                  w-full flex items-center justify-center py-3 px-4 rounded-xl font-bold text-white transition-all duration-300
                  ${isLoading || !uploadedImage
                    ? 'bg-indigo-300 cursor-not-allowed'
                    : 'bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-300'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Generating New Look... (This may take 30-60 seconds)
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 mr-2" />
                    Generate Outfit
                  </>
                )}
            </button>
        </div>

        {/* --- Results Section --- */}
        {errorMessage && (
          <div className="p-4 bg-red-100 text-red-700 rounded-xl mb-6 font-medium">
            Generation Failed: {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Original Photo</h2>
            <div className="min-h-80 flex items-center justify-center bg-gray-100 rounded-xl shadow-inner overflow-hidden border border-gray-200">
              {uploadedImage ? (
                <img
                  src={uploadedImage}
                  alt="Original uploaded photo"
                  className="w-full h-full object-contain max-h-[70vh] rounded-xl"
                />
              ) : (
                <div className="text-gray-400 text-center p-10">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <p>Upload your image to get started.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Generated Outfit</h2>
            <div className="min-h-80 flex items-center justify-center bg-indigo-50 rounded-xl shadow-inner relative overflow-hidden border border-indigo-200">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-80 z-10">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  <p className="mt-3 text-indigo-700 font-medium">AI is styling your new look...</p>
                </div>
              )}

              {generatedImage ? (
                <img
                  src={generatedImage}
                  alt="Generated photo with new clothing"
                  className="w-full h-full object-contain max-h-[70vh] rounded-xl"
                />
              ) : (
                <div className="text-gray-400 text-center p-10">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                  <p>Click "Generate Outfit" to see the result.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;


      
