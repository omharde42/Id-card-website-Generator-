import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CheckCircle, User, Building2, MapPin, Calendar, ArrowLeft, Shield, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import idcraftLogo from '@/assets/idcraft-logo.jpeg';

interface IDCardData {
  cardType: string;
  institution: string;
  institutionAddress: string;
  category: string;
  issuedBy: string;
  validFrom: string;
  profilePhoto?: string;
  [key: string]: string | undefined;
}

const Verify = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [cardData, setCardData] = useState<IDCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const data = searchParams.get('data');
    if (!data) {
      setError('No verification data found');
      return;
    }
    if (data.length > 8192) {
      setError('Verification payload too large');
      return;
    }
    try {
      const decoded = decodeURIComponent(atob(data));
      const parsed = JSON.parse(decoded);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Invalid verification data');
        return;
      }
      // Sanitize: keep only string scalar fields, truncate values
      const safe: IDCardData = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof k !== 'string' || k.length > 64) continue;
        if (v == null) continue;
        if (typeof v === 'string') safe[k] = v.slice(0, 512);
        else if (typeof v === 'number' || typeof v === 'boolean') safe[k] = String(v);
      }
      setCardData(safe);
    } catch {
      setError('Invalid or corrupted QR code data');
    }
  }, [searchParams]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `${cardData?.Name || cardData?.institution || 'ID-Card'}-Verification.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Verification card downloaded!');
    } catch (error) {
      toast.error('Failed to download');
    }
  };

  const excludedKeys = ['cardType', 'institution', 'institutionAddress', 'category', 'issuedBy', 'validFrom', 'address', 'emergencyContact', 'profilePhoto'];

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={idcraftLogo} alt="IDCRAFT Logo" className="w-10 h-10 object-contain rounded-lg" />
                <h1 className="text-xl font-bold text-foreground">IDCRAFT Verify</h1>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Verification Failed</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={idcraftLogo} alt="IDCRAFT Logo" className="w-10 h-10 object-contain rounded-lg" />
              <div>
                <h1 className="text-xl font-bold text-foreground">IDCRAFT Verify</h1>
                <p className="text-sm text-muted-foreground">ID Card Verification</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Verification Status */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Verified ID Card</h2>
              <p className="text-sm text-muted-foreground">This ID card data has been verified</p>
            </div>
          </div>

          {/* Card Details - Downloadable */}
          <Card ref={cardRef} className="border-border shadow-xl">
            <CardHeader className="bg-primary text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6" />
                  <div>
                    <CardTitle className="text-lg">{cardData.institution}</CardTitle>
                    {cardData.institutionAddress && (
                      <p className="text-sm opacity-80 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {cardData.institutionAddress}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {cardData.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Person Info */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20">
                  {cardData.profilePhoto ? (
                    <img 
                      src={cardData.profilePhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{cardData.Name || cardData['Student Name'] || cardData['Employee Name'] || 'N/A'}</h3>
                  <p className="text-sm text-muted-foreground">{cardData.cardType}</p>
                  {cardData.profilePhoto && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                      <CheckCircle className="w-3 h-3" />
                      Photo Verified
                    </span>
                  )}
                </div>
              </div>

              {/* All Fields */}
              <div className="grid gap-3">
                {Object.entries(cardData)
                  .filter(([key, value]) => !excludedKeys.includes(key) && key !== 'Name' && value)
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm font-medium text-muted-foreground">{key}</span>
                      <span className="text-sm font-semibold text-foreground">{value}</span>
                    </div>
                  ))}

                {/* Address */}
                {cardData.address && (
                  <div className="flex justify-between items-start py-2 border-b border-border/50">
                    <span className="text-sm font-medium text-muted-foreground">Address</span>
                    <span className="text-sm font-semibold text-foreground text-right max-w-[60%]">{cardData.address}</span>
                  </div>
                )}

                {/* Emergency Contact */}
                {cardData.emergencyContact && (
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm font-medium text-muted-foreground">Emergency Contact</span>
                    <span className="text-sm font-semibold text-foreground">{cardData.emergencyContact}</span>
                  </div>
                )}

                {/* Meta Info */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Issued: {cardData.validFrom}
                    </span>
                    <span>Authorized by: {cardData.issuedBy}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Download Button */}
          <div className="mt-6 flex justify-center">
            <Button onClick={handleDownload} className="gap-2">
              <Download className="w-4 h-4" />
              Download as PNG
            </Button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            Verified by IDCRAFT - Universal ID Card Generator
          </p>
        </div>
      </div>
    </div>
  );
};

export default Verify;
