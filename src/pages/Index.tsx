import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { LogOut, User, Loader2, FolderOpen, ScanLine, Users, Github, QrCode, ShieldCheck, Zap, Palette, Layers, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { IDCardConfig, CategoryType, getDefaultFields, signatoryTitles, IDCardField, defaultCardSizes } from '@/types/idCard';
import CategorySelector from '@/components/id-card/CategorySelector';
import FieldsManager from '@/components/id-card/FieldsManager';
import DesignControls from '@/components/id-card/DesignControls';
import ImageUploads from '@/components/id-card/ImageUploads';
import IDCardPreview from '@/components/id-card/IDCardPreview';
import ActionButtons from '@/components/id-card/ActionButtons';
import DesignSuggestions from '@/components/id-card/DesignSuggestions';
import ExtractDataFromPhoto from '@/components/id-card/ExtractDataFromPhoto';
import SavedCards from '@/components/id-card/SavedCards';
import QRScanner from '@/components/id-card/QRScanner';
import BulkGeneratorPanel from '@/components/id-card/bulk/BulkGeneratorPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ThemeToggle';
import idcraftLogo from '@/assets/idcraft-logo.jpeg';
const getInitialConfig = (category: CategoryType): IDCardConfig => ({
  category,
  institutionName: '',
  institutionAddress: '',
  layout: 'vertical',
  cardShape: 'rounded',
  cardSize: 'cr80',
  headerColor: '#2563eb',
  footerColor: '#1e40af',
  textColor: '#000000',
  photoSize: 90,
  fields: getDefaultFields(category),
  profilePhoto: null,
  institutionLogo: null,
  authorizedSignature: null,
  backgroundImage: null,
  showQRCode: true,
  signatoryTitle: signatoryTitles[category]
});
const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [config, setConfig] = useState<IDCardConfig>(getInitialConfig('school'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCardsRefresh, setSavedCardsRefresh] = useState(0);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showBulkGenerator, setShowBulkGenerator] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };
  const handleCategoryChange = useCallback((category: CategoryType) => {
    setConfig(prev => ({
      ...prev,
      category,
      fields: getDefaultFields(category),
      signatoryTitle: signatoryTitles[category],
      cardSize: defaultCardSizes[category]
    }));
  }, []);
  const handleConfigUpdate = useCallback((updates: Partial<IDCardConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...updates
    }));
  }, []);
  const handleDataExtracted = useCallback((updates: Partial<IDCardConfig>, fields: IDCardField[]) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
      fields
    }));
  }, []);
  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      const name = config.fields.find(f => f.key === 'name')?.value || 'ID-Card';
      link.download = `${name.replace(/\s+/g, '-')}-ID-Card.png`;
      link.href = dataUrl;
      link.click();
      toast.success('ID Card downloaded successfully!');
    } catch (error) {
      console.error('Error generating ID card:', error);
      toast.error('Failed to generate ID card. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [config.fields]);
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  const handleReset = useCallback(() => {
    setConfig(getInitialConfig(config.category));
    setEditingCardId(null);
    toast.info('Form has been reset');
  }, [config.category]);
  const handleLoadSavedCard = useCallback((savedConfig: IDCardConfig, cardId: string) => {
    setConfig(savedConfig);
    setEditingCardId(cardId);
  }, []);
  const handleSave = useCallback(async (saveAsNew: boolean = false) => {
    if (!cardRef.current || !user) return;
    setIsSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Generate unique filename
      const name = config.fields.find(f => f.key === 'name')?.value || 'ID-Card';
      const timestamp = Date.now();
      const fileName = `${user.id}/${name.replace(/\s+/g, '-')}-${timestamp}.png`;

      // Upload to storage
      const {
        data: uploadData,
        error: uploadError
      } = await supabase.storage.from('id-cards').upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false
      });
      if (uploadError) throw uploadError;

      // Get signed URL (valid for 1 year - 31536000 seconds)
      const {
        data: signedUrlData,
        error: signedUrlError
      } = await supabase.storage.from('id-cards').createSignedUrl(fileName, 31536000);
      if (signedUrlError) throw signedUrlError;
      const imageUrl = signedUrlData.signedUrl;

      if (editingCardId && !saveAsNew) {
        // Update existing card
        const { error: dbError } = await supabase
          .from('saved_id_cards')
          .update({
            name: name,
            category: config.category,
            institution_name: config.institutionName || null,
            image_url: imageUrl,
            config: config as any
          } as any)
          .eq('id', editingCardId);
        if (dbError) throw dbError;
        toast.success('ID Card updated successfully!');
      } else {
        // Save new card to database
        const {
          error: dbError
        } = await supabase.from('saved_id_cards').insert([{
          user_id: user.id,
          name: name,
          category: config.category,
          institution_name: config.institutionName || null,
          image_url: imageUrl,
          config: config as unknown as Record<string, unknown>
        }] as any);
        if (dbError) throw dbError;
        toast.success(saveAsNew ? 'ID Card saved as new copy!' : 'ID Card saved to your account!');
        if (saveAsNew) {
          setEditingCardId(null);
        }
      }
      
      setSavedCardsRefresh(prev => prev + 1);
    } catch (error) {
      console.error('Error saving ID card:', error);
      toast.error('Failed to save ID card. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [config, user, editingCardId]);

  const handleSaveAsNew = useCallback(() => {
    handleSave(true);
  }, [handleSave]);

  // Show loading spinner while checking auth
  if (isAuthLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>;
  }

  // Show login prompt if not authenticated
  if (!user) {
    return <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={idcraftLogo} alt="IDCRAFT Logo" className="w-12 h-12 object-contain rounded-lg" />
                <div>
                  <h1 className="text-xl font-bold text-foreground">IDCRAFT</h1>
                  <p className="text-sm text-muted-foreground">
                    Universal ID Card Generator
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button variant="default" size="sm" onClick={() => navigate('/auth')}>
                  Login
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Login Required Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6 p-8">
            <img src={idcraftLogo} alt="IDCRAFT Logo" className="mx-auto w-24 h-24 object-contain rounded-xl shadow-lg" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Welcome to IDCRAFT</h2>
              <p className="text-muted-foreground max-w-md">Please login or create an account to start generating professional ID cards for schools, offices, events, and more. </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/auth')} size="lg">
                Login to Get Started
              </Button>
            </div>
          </div>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={idcraftLogo} alt="IDCRAFT Logo" className="w-12 h-12 object-contain rounded-lg" />
              <div>
                <h1 className="text-xl font-bold text-foreground">IDCRAFT</h1>
                <p className="text-sm text-muted-foreground">
                  Universal ID Card Generator
                </p>
              </div>
            </div>
            
            {/* Auth Section */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="default" size="sm" onClick={() => setShowBulkGenerator(true)} className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Bulk Generate</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowQRScanner(true)} className="flex items-center gap-2">
                <ScanLine className="w-4 h-4" />
                <span className="hidden sm:inline">Scan to Report</span>
              </Button>
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="max-w-[150px] truncate">{user.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 text-orange-400">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel - Controls */}
          <div className="w-full lg:w-[420px] flex-shrink-0">
            <div className="bg-card rounded-xl border border-border shadow-sm">
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="p-5 space-y-6">
                  {/* Step 1: Category Selection */}
                  <CategorySelector selected={config.category} onChange={handleCategoryChange} />

                  <Separator />

                  {/* Step 2: Image Uploads */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                      Upload Images
                    </label>
                    <ImageUploads config={config} onChange={handleConfigUpdate} />
                  </div>

                  <Separator />

                  {/* Step 3: Fields Manager */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                      Details & Fields
                    </label>
                    <FieldsManager fields={config.fields} onChange={fields => handleConfigUpdate({
                    fields
                  })} />
                  </div>

                  <Separator />

                  {/* Step 4: Design Controls */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                      Design & Layout
                    </label>
                    <DesignControls config={config} onChange={handleConfigUpdate} />
                  </div>

                  <Separator />

                  {/* Step 5: AI Features */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold">✨</span>
                      AI Features
                    </label>
                    <div className="grid gap-2">
                      <ExtractDataFromPhoto category={config.category} onDataExtracted={handleDataExtracted} currentFields={config.fields} />
                      <DesignSuggestions category={config.category} institutionName={config.institutionName} currentColors={{
                      headerColor: config.headerColor,
                      footerColor: config.footerColor
                    }} onApplySuggestions={handleConfigUpdate} />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel - Preview & Saved Cards */}
          <div className="flex-1 flex flex-col gap-6">
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="preview">Live Preview</TabsTrigger>
                <TabsTrigger value="saved" className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Saved Cards
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="preview" className="mt-4">
                <div className="bg-muted/50 rounded-xl border border-border p-6 flex flex-col items-center justify-center min-h-[600px]">
                  <p className="text-sm text-muted-foreground mb-6">Live Preview</p>
                  
                  {/* ID Card Preview */}
                  <div className="print:m-0" id="id-card-preview">
                    <IDCardPreview ref={cardRef} config={config} />
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-8 w-full max-w-md">
                    <ActionButtons onDownload={handleDownload} onPrint={handlePrint} onReset={handleReset} onSave={() => handleSave(false)} onSaveAsNew={handleSaveAsNew} isGenerating={isGenerating} isSaving={isSaving} isEditing={!!editingCardId} />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="saved" className="mt-4">
                <div className="bg-muted/50 rounded-xl border border-border p-6 min-h-[600px]">
                  <SavedCards userId={user.id} refreshTrigger={savedCardsRefresh} onLoadCard={handleLoadSavedCard} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #id-card-preview,
          #id-card-preview * {
            visibility: visible;
          }
          #id-card-preview {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>

      {/* QR Scanner Modal */}
      <QRScanner open={showQRScanner} onClose={() => setShowQRScanner(false)} />

      {/* Bulk Generator Modal */}
      {showBulkGenerator && (
        <BulkGeneratorPanel
          category={config.category}
          onClose={() => setShowBulkGenerator(false)}
        />
      )}
    </div>;
};
export default Index;