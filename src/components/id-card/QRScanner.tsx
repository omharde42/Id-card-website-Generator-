import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, User, Building, MapPin, Phone, Mail, CreditCard, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface ScannedData {
  cardType?: string;
  institution?: string;
  institutionAddress?: string;
  category?: string;
  address?: string;
  emergencyContact?: string;
  issuedBy?: string;
  validFrom?: string;
  [key: string]: string | undefined;
}

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ open, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountId = 'qr-reader';

  const startScanner = async () => {
    setError(null);
    setScannedData(null);
    
    try {
      const scanner = new Html5Qrcode(mountId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
          stopScanner();
        },
        () => {
          // Ignore scan errors (no QR found in frame)
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error('Scanner error:', err);
      setError(err?.message || 'Failed to start camera. Please ensure camera permissions are granted.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    // Hard cap on payload size to prevent UI overflow / abuse
    if (decodedText.length > 4096) {
      toast.error('QR payload too large');
      return;
    }
    try {
      const parsed = JSON.parse(decodedText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setScannedData({ rawData: decodedText.slice(0, 1024) });
        toast.success('QR Code scanned!');
        return;
      }
      // Sanitize: keep only string/number/boolean values, truncate strings
      const safe: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k !== 'string' || k.length > 64) continue;
        if (v == null) continue;
        if (typeof v === 'string') safe[k] = v.slice(0, 512);
        else if (typeof v === 'number' || typeof v === 'boolean') safe[k] = String(v);
      }
      setScannedData(safe);
      toast.success('QR Code scanned successfully!');
    } catch {
      // If not JSON, treat as plain text
      setScannedData({ rawData: decodedText.slice(0, 1024) });
      toast.success('QR Code scanned!');
    }
  };

  const handleClose = () => {
    stopScanner();
    setScannedData(null);
    setError(null);
    onClose();
  };

  const resetScanner = () => {
    setScannedData(null);
    setError(null);
    startScanner();
  };

  useEffect(() => {
    if (open && !scannedData) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    }
    
    return () => {
      stopScanner();
    };
  }, [open]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const getFieldIcon = (key: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      name: <User className="w-4 h-4" />,
      institution: <Building className="w-4 h-4" />,
      institutionAddress: <MapPin className="w-4 h-4" />,
      address: <MapPin className="w-4 h-4" />,
      phone: <Phone className="w-4 h-4" />,
      mobile: <Phone className="w-4 h-4" />,
      email: <Mail className="w-4 h-4" />,
      emergencyContact: <Phone className="w-4 h-4" />,
    };
    return iconMap[key] || <CreditCard className="w-4 h-4" />;
  };

  const formatLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const renderScannedData = () => {
    if (!scannedData) return null;

    const { cardType, institution, institutionAddress, category, ...otherFields } = scannedData;

    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              ID Card Verified
            </CardTitle>
            {category && (
              <Badge variant="secondary" className="capitalize">
                {category}
              </Badge>
            )}
          </div>
          {institution && (
            <p className="text-sm text-muted-foreground font-medium">{institution}</p>
          )}
          {institutionAddress && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {institutionAddress}
            </p>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-3">
              {Object.entries(otherFields).map(([key, value]) => {
                if (!value || key === 'rawData') return null;
                return (
                  <div key={key} className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      {getFieldIcon(key)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{formatLabel(key)}</p>
                      <p className="text-sm font-medium break-words">{value}</p>
                    </div>
                  </div>
                );
              })}
              {scannedData.rawData && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Raw Data</p>
                  <p className="text-sm font-mono break-all">{scannedData.rawData}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            QR Code Scanner
          </DialogTitle>
          <DialogDescription>
            {scannedData 
              ? 'ID Card data verified successfully' 
              : 'Point your camera at an ID card QR code to verify'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Camera Error</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          {!scannedData && (
            <div 
              id={mountId} 
              className="w-full aspect-square bg-secondary/50 rounded-lg overflow-hidden"
            />
          )}

          {scannedData && renderScannedData()}

          <div className="flex gap-2">
            {scannedData ? (
              <>
                <Button variant="outline" onClick={resetScanner} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Scan Another
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Done
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleClose} className="w-full">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;