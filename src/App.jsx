import { useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import ConfigForm from './components/ConfigForm';
import PreviewPanel from './components/PreviewPanel';
import { generateLandingPages } from './lib/generator';

/**
 * Main App — sidebar config + preview panel layout
 */
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);

  // Config state
  const [config, setConfig] = useState({
    productName: '',
    productDescription: '',
    productBenefits: '',
    language: 'Tiếng Việt',
    productImages: [],
    referenceUrl: '',
    referenceHtml: '',
    model: localStorage.getItem('gemini_model') || 'gemini-3.1-pro',
    colors: null,
    customFormFields: [],
    googleSheetWebhook: '',
    googleAdsTracking: '',
    facebookPixelId: '',
    tiktokPixelId: '',
    apiKey: localStorage.getItem('gemini_api_key') || '',
  });

  // Generated landing page (single variant)
  const [generatedHtml, setGeneratedHtml] = useState(null);

  // Toggle dark/light mode
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.className = newTheme === 'light' ? 'light' : '';
  };

  // Generate landing page
  const handleGenerate = useCallback(async () => {
    if (!config.productName?.trim()) return;

    setIsGenerating(true);
    setError(null);
    setProgress('Đang khởi tạo...');

    try {
      const result = await generateLandingPages(config, config.apiKey, (msg) => {
        setProgress(msg);
      });
      setGeneratedHtml(result.variantA);
      setProgress('');
    } catch (err) {
      console.error('Generation failed:', err);
      setError(err.message);
      setProgress('');
    } finally {
      setIsGenerating(false);
    }
  }, [config]);

  // Update HTML after editor save
  const handleUpdateHtml = useCallback((newHtml) => {
    setGeneratedHtml(newHtml);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top bar — mobile only */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <span className="text-sm font-bold">LDP Generator</span>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Sidebar — fixed width, scrollable */}
        <div className="relative w-full lg:w-[340px] xl:w-[380px] flex-shrink-0">
          <ConfigForm
            config={config}
            setConfig={setConfig}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            progress={progress}
            generatedHtml={generatedHtml}
          />
          {/* Theme toggle — desktop, floating */}
          <button
            onClick={toggleTheme}
            className="hidden lg:flex absolute top-4 right-4 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors z-20"
            title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Main preview area — takes ALL remaining space */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex-shrink-0">
              <strong>Lỗi:</strong> {error}
            </div>
          )}

          <PreviewPanel html={generatedHtml} onUpdateHtml={handleUpdateHtml} />
        </div>
      </div>
    </div>
  );
}
