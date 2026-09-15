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

        {/* Hero Section */}
        <section className="flex-1">
          <div className="container mx-auto px-4 py-16 md:py-24 text-center space-y-8">
            <img src={idcraftLogo} alt="IDCRAFT Logo" className="mx-auto w-28 h-28 object-contain rounded-2xl shadow-xl" />
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
                Design Professional ID Cards <span className="text-primary">in Minutes</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                IDCRAFT is a universal ID card generator for schools, offices, events, gyms and more. Design, customize, and download print-ready ID cards with smart QR codes — no design skills needed.
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => navigate('/auth')} size="lg" className="gap-2">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="lg" className="gap-2" asChild>
                <a href="https://github.com/omharde42/Id-card-website-Generator-.git" target="_blank" rel="noopener noreferrer">
                  <Github className="w-4 h-4" /> View on GitHub
                </a>
              </Button>
            </div>
          </div>

          {/* About Us */}
          <div className="bg-muted/50 border-y border-border">
            <div className="container mx-auto px-4 py-16 max-w-4xl text-center space-y-4">
              <h3 className="text-3xl font-bold text-foreground">About Us</h3>
              <p className="text-muted-foreground leading-relaxed">
                IDCRAFT was built with one simple mission: to make professional ID card creation accessible to everyone. Whether you're a school issuing student IDs, a company onboarding employees, or an event organizer managing attendees, IDCRAFT gives you a fast, secure and beautiful way to generate identity cards — complete with photos, custom fields, and scannable QR codes that carry full cardholder details for instant verification.
              </p>
            </div>
          </div>

          {/* Why Choose IDCRAFT */}
          <div className="container mx-auto px-4 py-16 max-w-6xl">
            <div className="text-center space-y-3 mb-12">
              <h3 className="text-3xl font-bold text-foreground">Why Choose IDCRAFT?</h3>
              <p className="text-muted-foreground max-w-xl mx-auto">Everything you need to create, manage and verify ID cards — all in one place.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: QrCode, title: 'Smart QR Verification', desc: 'Every card carries a QR code with full cardholder details — scan it with any app to instantly verify identity.' },
                { icon: Users, title: 'Bulk Generation', desc: 'Import hundreds of records from Excel or CSV and generate print-ready cards for everyone in one click.' },
                { icon: Palette, title: 'Full Customization', desc: 'Choose layouts, shapes, sizes, colors, custom fields and photos. Your brand, your design, your way.' },
                { icon: Sparkles, title: 'AI-Powered Tools', desc: 'Extract data from photos automatically and get smart design suggestions powered by AI.' },
                { icon: ShieldCheck, title: 'Secure by Design', desc: 'Your cards and photos are stored privately with signed URLs, rate-limited auth and protected access.' },
                { icon: Zap, title: 'Fast & Print-Ready', desc: 'Download high-resolution PNG cards instantly, or export a whole batch as a ZIP — ready for printing.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-card rounded-xl border border-border p-6 space-y-3 hover:shadow-md transition-shadow">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">{title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What Makes It Special */}
          <div className="bg-muted/50 border-y border-border">
            <div className="container mx-auto px-4 py-16 max-w-4xl text-center space-y-6">
              <div className="inline-flex items-center gap-2 text-primary font-semibold">
                <Layers className="w-5 h-5" /> What Makes IDCRAFT Special
              </div>
              <h3 className="text-3xl font-bold text-foreground">One Tool. Every Identity Card.</h3>
              <p className="text-muted-foreground leading-relaxed">
                Unlike generic design tools, IDCRAFT understands ID cards. It supports standard card sizes like CR80, dynamic portrait and landscape orientations, institution-specific signatory titles, and photo-to-record matching for bulk jobs. Save your designs to your account, search and edit them anytime, and trust that every QR code stays perfectly in sync with the card it belongs to.
              </p>
              <Button onClick={() => navigate('/auth')} size="lg" className="gap-2">
                Start Creating Now <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50">
          <div className="container mx-auto px-4 py-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <img src={idcraftLogo} alt="IDCRAFT Logo" className="w-10 h-10 object-contain rounded-lg" />
                <div>
                  <p className="font-bold text-foreground">IDCRAFT</p>
                  <p className="text-xs text-muted-foreground">Universal ID Card Generator</p>
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  Made by <span className="font-semibold text-foreground">Om Harde</span> — Founder & CEO of <span className="font-semibold text-foreground">B2C Solution</span>
                </p>
                <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} IDCRAFT. All rights reserved.</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href="https://github.com/omharde42/Id-card-website-Generator-.git" target="_blank" rel="noopener noreferrer">
                  <Github className="w-4 h-4" /> Star on GitHub
                </a>
              </Button>
            </div>
          </div>
        </footer>
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