import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Mode = "credentials" | "mfa";

const Auth = () => {
  const navigate = useNavigate();
  const { login, signup, verifyMfa } = useAuth();

  const [mode, setMode] = useState<Mode>("credentials");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [country, setCountry] = useState<"GH" | "NG">("GH");

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [totp, setTotp] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    setLoading(true);
    try {
      const { mfaRequired, challengeId: cid } = await login(email, password);
      if (mfaRequired && cid) { setChallengeId(cid); setMode("mfa"); toast.info("Enter your 6-digit MFA code"); }
      else { toast.success("Welcome back"); navigate("/dashboard"); }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally { setLoading(false); }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId || !totp) return;
    setLoading(true);
    try {
      await verifyMfa(challengeId, totp);
      toast.success("MFA verified");
      navigate("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid MFA code");
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName || !organizationName) { toast.error("Please fill in all fields"); return; }
    if (password.length < 12) { toast.error("Password must be at least 12 characters"); return; }
    setLoading(true);
    try {
      await signup({ email, password, fullName, organizationName, country });
      toast.success("Account created — welcome!");
      navigate("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign-up failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <Card className="w-full max-w-md shadow-medium">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Pic Shift</CardTitle>
          <CardDescription>HR operating system — Ghana &amp; Nigeria</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "mfa" ? (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <Label htmlFor="totp">6-digit MFA code</Label>
              <Input id="totp" inputMode="numeric" maxLength={6} value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} placeholder="123456" disabled={loading} />
              <Button type="submit" className="w-full" disabled={loading || totp.length !== 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("credentials")}>Back</Button>
            </form>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Org</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} /></div>
                  <div className="space-y-2"><Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} /></div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="signup-org">Organization name</Label>
                    <Input id="signup-org" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} disabled={loading} /></div>
                  <div className="space-y-2"><Label htmlFor="signup-country">Country</Label>
                    <Select value={country} onValueChange={(v) => setCountry(v as "GH" | "NG")}>
                      <SelectTrigger id="signup-country"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GH">Ghana</SelectItem>
                        <SelectItem value="NG">Nigeria</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label htmlFor="signup-name">Your full name</Label>
                    <Input id="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} /></div>
                  <div className="space-y-2"><Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} /></div>
                  <div className="space-y-2"><Label htmlFor="signup-password">Password (12+ chars, mixed case, digit, symbol)</Label>
                    <Input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} /></div>
                  <p className="text-xs text-muted-foreground">By creating an account you accept our Terms of Service and Privacy Policy (Ghana DPA Act 843 + NDPR 2019 + GDPR).</p>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create organization"}</Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
