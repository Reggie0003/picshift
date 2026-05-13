import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export default function SecurityPage() {
  const [qr, setQr] = useState<string | null>(null);
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const r = await api.auth.enrollMfa();
      setQr(r.qrPngDataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (totp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setBusy(true);
    try {
      await api.auth.enrollMfaVerify(totp);
      toast.success("MFA enabled — your account is now protected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen container mx-auto p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Security</h1>
        <Link to="/dashboard"><Button variant="outline">Back</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Multi-factor authentication (TOTP)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Use Google Authenticator, Authy, 1Password, Microsoft Authenticator, or any RFC-6238 client.</p>
          {!qr && <Button onClick={() => void start()} disabled={busy}>Start enrollment</Button>}
          {qr && (
            <>
              <img src={qr} alt="MFA QR code" className="w-48 h-48 border rounded" />
              <div className="space-y-2">
                <Label htmlFor="confirm-totp">Enter the 6-digit code from your app</Label>
                <Input id="confirm-totp" inputMode="numeric" maxLength={6} value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
                <Button onClick={() => void confirm()} disabled={busy || totp.length !== 6}>Confirm and enable MFA</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
